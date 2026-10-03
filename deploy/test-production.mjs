// Local Docker acceptance only. Never reads application .env or touches its DB.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const project = `core-ops-test-${randomBytes(5).toString('hex')}`;
const directory = resolve(root, '.ops-test', project);
mkdirSync(directory, { recursive: true });
mkdirSync(resolve(directory, 'backups'));
const write = (name, value) => writeFileSync(resolve(directory, name), value, { mode: 0o600 });
write('postgres_password', randomBytes(32).toString('hex'));
write('redis_password', randomBytes(32).toString('hex'));
write('backend.env', [
  `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}`,
  `INTEGRATION_CREDENTIALS_KEY=${randomBytes(32).toString('base64')}`,
  'GOOGLE_CLIENT_ID=local-test-only', 'GOOGLE_CLIENT_SECRET=local-test-only',
].join('\n'));
write('compose.env', '# Test has no external service credentials\n');
const env = {
  ...process.env, RELEASE_TAG: 'ops-test', DEPLOYMENT_ENV: 'staging',
  WEB_DOMAIN: 'ops-test.example.com', API_DOMAIN: 'api.ops-test.example.com',
  AUTH_COOKIE_DOMAIN: 'ops-test.example.com', ACME_EMAIL: 'test@example.com',
  PADDLE_ENV: 'sandbox', PADDLE_CLIENT_TOKEN: 'test_ops_placeholder',
  SECRETS_DIR: directory.replaceAll('\\', '/'), BACKUP_DIR: resolve(directory, 'backups').replaceAll('\\', '/'),
};
const args = ['compose', '--env-file', resolve(directory, 'compose.env'), '-p', project, '-f', 'docker-compose.production.yml'];
function docker(command, options = {}) {
  const result = spawnSync('docker', command, { cwd: root, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`Docker ${command[0]} failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
const compose = (...command) => docker([...args, ...command]);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function probe(path, expected) {
  const code = `fetch('http://127.0.0.1:4001${path}',{signal:AbortSignal.timeout(4000)}).then(r=>{if(r.status!==${expected})throw Error('status '+r.status)}).catch(e=>{console.error(e.message);process.exit(1)})`;
  compose('exec', '-T', 'backend', 'node', '-e', code);
}
function proxyProbe(host, path, expected) {
  const code = `require('node:http').get({hostname:'proxy',path:${JSON.stringify(path)},headers:{host:${JSON.stringify(host)},referer:'https://example.com/invite/fake-invitation-secret-ops-check'}},r=>{r.resume();if(!${JSON.stringify(expected)}.includes(r.statusCode)){console.error('status '+r.statusCode);process.exitCode=1}}).on('error',e=>{console.error(e.message);process.exitCode=1})`;
  compose('exec', '-T', 'frontend', 'node', '-e', code);
}

console.log(`Isolated project: ${project}`);
try {
  compose('config', '--quiet');
  console.log('Compose configuration accepted.');
  compose('--profile', 'ops', 'build', 'backup');
  compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '120', 'backend', 'frontend');
  console.log('Migration, backend readiness and standalone frontend healthy.');
  for (const service of ['postgres', 'redis', 'backend', 'frontend']) {
    const id = compose('ps', '-q', service);
    const info = JSON.parse(docker(['inspect', id]))[0];
    assert.ok(!info.HostConfig.PortBindings || Object.keys(info.HostConfig.PortBindings).length === 0);
    if (service === 'backend' || service === 'frontend') {
      assert.equal(info.Config.User, 'node');
      assert.equal(info.HostConfig.ReadonlyRootfs, true);
    }
  }
  probe('/health/ready', 200);
  const redisCommand = (command) => compose('exec', '-T', 'redis', 'sh', '-c', `export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli ${command}`);
  assert.ok(redisCommand('CONFIG GET maxmemory-policy').includes('noeviction'));
  assert.ok(redisCommand('INFO persistence').includes('aof_enabled:1'));
  redisCommand('SET ops-persistence-probe survived');
  await sleep(1100);
  compose('restart', 'redis');
  await sleep(2000);
  assert.equal(redisCommand('GET ops-persistence-probe'), 'survived');
  console.log('Redis AOF/noeviction configured; stored data survived restart.');
  for (const dependency of ['postgres', 'redis']) {
    const id = compose('ps', '-q', dependency);
    docker(['pause', id]);
    try {
      await sleep(1100);
      probe('/health/ready', 503);
      probe('/health', 200);
      console.log(`${dependency} outage: readiness 503, liveness 200.`);
    } finally { docker(['unpause', id]); }
    await sleep(2500);
    probe('/health/ready', 200);
  }
  compose('run', '--rm', '--no-deps', 'proxy', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile');
  console.log('Production Caddy configuration valid.');
  // Same proxy directives, HTTP-only internal test origins; no certificate requests or published ports.
  // Compose !reset deliberately removes production's published ports in the test override.
  write('proxy.yml', `services:\n  proxy:\n    ports: !reset []\n    environment:\n      WEB_DOMAIN: http://ops-test.example.com\n      API_DOMAIN: http://api.ops-test.example.com\n`);
  const proxyArgs = [...args, '-f', resolve(directory, 'proxy.yml')];
  docker([...proxyArgs, 'up', '-d', '--no-build', 'proxy']);
  await sleep(1500);
  const marker = 'fake-invitation-secret-ops-check';
  proxyProbe('api.ops-test.example.com', `/workspace-invitations/${marker}`, [400, 401, 403, 404]);
  proxyProbe('api.ops-test.example.com', `/workspace-invitations%2F${marker}`, [400, 401, 403, 404]);
  proxyProbe('api.ops-test.example.com', `/health?token=${marker}`, [200]);
  proxyProbe('ops-test.example.com', '/login', [200]);
  assert.ok(!compose('logs', '--no-color', 'proxy').includes(marker));
  console.log('Proxy HTTP and invitation access-log redaction passed.');

  const backupImage = `${project}-backup`;
  docker(['run', '--rm', '-v', `${directory}:/test`, '--entrypoint', 'age-keygen', backupImage, '-o', '/test/identity']);
  env.AGE_RECIPIENT = docker(['run', '--rm', '-v', `${directory}:/test:ro`, '--entrypoint', 'age-keygen', backupImage, '-y', '/test/identity']);
  compose('exec', '-T', 'postgres', 'psql', '-U', 'core_assist', '-d', 'core_assist', '-c', "CREATE TABLE ops_restore_probe (value text); INSERT INTO ops_restore_probe VALUES ('restore-verified');");
  compose('--profile', 'ops', 'run', '--rm', '--no-deps', 'backup');
  const backup = readdirSync(resolve(directory, 'backups')).find((name) => name.endsWith('.dump.age'));
  assert.ok(backup);
  compose('--profile', 'ops', 'run', '--rm', '--no-deps', '-e', 'RESTORE_DATABASE=restore_ops_probe', '-v', `${directory}/identity:/run/secrets/backup_identity:ro`, '--entrypoint', 'bash', 'backup', '/usr/local/bin/core-restore', backup);
  assert.equal(compose('exec', '-T', 'postgres', 'psql', '-U', 'core_assist', '-d', 'restore_ops_probe', '-Atc', 'SELECT value FROM ops_restore_probe'), 'restore-verified');
  console.log('Encrypted PostgreSQL dump restored into separate DB; data verified.');
  const before = Date.now();
  compose('stop', '-t', '170', 'backend');
  const id = compose('ps', '--all', '-q', 'backend');
  const stopped = JSON.parse(docker(['inspect', id]))[0];
  assert.equal(stopped.State.ExitCode, 0);
  assert.ok(compose('logs', '--no-color', 'backend').includes('Backend shutdown completed.'));
  console.log(`Real backend SIGTERM completed in ${Date.now() - before}ms; exit 0.`);
  // Exercise error logs too: unhealthy upstream with a token-bearing URL.
  await sleep(6500);
  proxyProbe('api.ops-test.example.com', `/workspace-invitations/${marker}`, [502, 503]);
  assert.ok(!compose('logs', '--no-color', 'proxy').includes(marker));
  console.log('Proxy upstream-error log redaction passed.');
  const harnessName = `${project}-drain-probe`;
  try {
    compose('run', '-d', '--no-deps', '--name', harnessName, '-v', `${root}/deploy/runtime-smoke.cjs:/app/runtime-smoke.cjs:ro`, 'backend', 'runtime-smoke.cjs');
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (docker(['logs', harnessName]).includes('READY_FOR_SIGNAL')) { ready = true; break; }
      await sleep(100);
    }
    assert.ok(ready, 'Drain probe did not start');
    assert.equal(compose('exec', '-T', 'postgres', 'psql', '-U', 'core_assist', '-d', 'core_assist', '-Atc', "SELECT count(*) FROM ops_restore_probe WHERE value IN ('worker-drained','http-drained')"), '0', 'Work must still be active when SIGTERM is sent');
    docker(['stop', '-t', '20', harnessName]);
    assert.equal(JSON.parse(docker(['inspect', harnessName]))[0].State.ExitCode, 0);
    assert.equal(compose('exec', '-T', 'postgres', 'psql', '-U', 'core_assist', '-d', 'core_assist', '-Atc', "SELECT count(*) FROM ops_restore_probe WHERE value IN ('worker-drained','http-drained')"), '2');
    console.log('SIGTERM with real BullMQ work + HTTP request + notification SSE: both DB writes completed before disconnect.');
  } finally { docker(['rm', '-f', harnessName]); }
  console.log('Production Docker acceptance passed. Off-site credentials and public TLS remain staging tasks.');
} finally {
  try { write('containers.log', compose('logs', '--no-color')); } catch { /* Preserve cleanup if startup failed early. */ }
  // The only removable volumes belong to this random, locally generated project.
  assert.match(project, /^core-ops-test-[a-f0-9]{10}$/);
  compose('--profile', 'ops', 'down', '--volumes', '--remove-orphans');
  spawnSync('docker', ['image', 'rm', `${project}-backup`], { cwd: root, env, stdio: 'ignore', timeout: 30_000 });
  console.log('Isolated test containers and volumes removed.');
}
