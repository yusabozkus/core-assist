import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

function config(example, extraArgs = []) {
  // Ignore shell overrides so these tests verify the checked-in examples only.
  const env = { ...process.env };
  const keys = readFileSync(resolve(root, 'deploy', example), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => line.split('=')[0]);
  for (const key of Object.keys(env)) {
    if (keys.includes(key.toUpperCase()) || key.toUpperCase().startsWith('COMPOSE_')) {
      delete env[key];
    }
  }
  return JSON.parse(execFileSync('docker', [
    'compose', '--env-file', `deploy/${example}`,
    '-f', 'docker-compose.production.yml', '--profile', 'ops', ...extraArgs,
    'config', '--format', 'json',
  ], { cwd: root, env, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }));
}

test('staging and production resolve to separate persistent resources', () => {
  const production = config('.env.example');
  const staging = config('.env.staging.example');
  assert.equal(production.name, 'core-assist-production');
  assert.equal(staging.name, 'core-assist-staging');
  for (const key of ['postgres_data', 'redis_data', 'caddy_data', 'caddy_config']) {
    assert.equal(production.volumes[key].name, `core-assist-production_${key}`);
    assert.equal(staging.volumes[key].name, `core-assist-staging_${key}`);
  }
  for (const key of ['application', 'data']) {
    assert.notEqual(production.networks[key].name, staging.networks[key].name);
  }
  for (const key of ['backend_env', 'postgres_password', 'redis_password']) {
    assert.notEqual(production.secrets[key].file, staging.secrets[key].file);
  }
  const backupPath = (value) => value.services.backup.volumes.find((v) => v.target === '/backups').source;
  assert.notEqual(backupPath(production), backupPath(staging));
  for (const key of ['backend', 'frontend']) {
    assert.notEqual(production.services[key].image, staging.services[key].image);
  }
});

test('staging uses sandbox billing and its own cookie and public build origins', () => {
  const staging = config('.env.staging.example');
  const backend = staging.services.backend.environment;
  assert.equal(backend.NODE_ENV, 'production');
  assert.equal(backend.DEPLOYMENT_ENV, 'staging');
  assert.equal(backend.PADDLE_ENV, 'sandbox');
  assert.equal(backend.AUTH_COOKIE_DOMAIN, 'staging.example.net');
  assert.equal(backend.FRONTEND_URL, 'https://staging.example.net');
  assert.equal(backend.BETTER_AUTH_URL, 'https://api.staging.example.net');
  assert.equal(staging.services.frontend.build.args.NEXT_PUBLIC_API_URL, backend.BETTER_AUTH_URL);
  assert.equal(staging.services.frontend.build.args.NEXT_PUBLIC_PADDLE_ENV, 'sandbox');
});

test('explicit isolated test projects still override the deployment name', () => {
  const isolated = config('.env.staging.example', ['-p', 'core-ops-config-test']);
  assert.equal(isolated.name, 'core-ops-config-test');
  assert.equal(isolated.volumes.postgres_data.name, 'core-ops-config-test_postgres_data');
});
