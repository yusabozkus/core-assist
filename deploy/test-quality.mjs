// Reproduce CI commands on Linux without application env files or databases.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
// Resolve deployment examples before starting the Linux application checks.
execFileSync(process.execPath, ['--test', 'deploy/compose-config.test.mjs'], {
  cwd: root, stdio: 'inherit', timeout: 120_000,
});
const project = `core-quality-test-${randomBytes(5).toString('hex')}`;
const directory = resolve(root, '.ops-test', project);
mkdirSync(directory, { recursive: true });
function snapshot(name, files) {
  const target = resolve(directory, name);
  mkdirSync(target);
  for (const file of files) {
    const source = resolve(root, name, file);
    if (!existsSync(source)) throw new Error(`Missing test input: ${name}/${file}`);
    cpSync(source, resolve(target, file), { recursive: true });
  }
  return target;
}
const backend = snapshot('backend', [
  'package.json', 'package-lock.json', 'prisma', 'prisma.config.ts',
  'tsconfig.json', 'tsconfig.build.json', 'nest-cli.json',
  'eslint.config.mjs', '.prettierrc', 'src', 'scripts', 'test',
]);
const frontend = snapshot('frontend', [
  'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts',
  'eslint.config.mjs', 'postcss.config.mjs', 'app', 'components', 'hooks',
  'lib', 'public', 'types', 'scripts', 'constants', '.prettierrc',
]);
writeFileSync(resolve(backend, 'Dockerfile'), `FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run db:generate
CMD ["sh", "-c", "npm audit --omit=dev && npm run check && npm run test:integration"]
`);
writeFileSync(resolve(frontend, 'Dockerfile'), `FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["sh", "-c", "npm audit --omit=dev && npm run check"]
`);
const dbUrl = 'postgresql://postgres:local_test_only@127.0.0.1:5432/postgres';
writeFileSync(resolve(directory, 'compose.json'), JSON.stringify({
  services: {
    postgres: {
      image: 'postgres:16-alpine',
      environment: { POSTGRES_PASSWORD: 'local_test_only' },
      healthcheck: { test: ['CMD-SHELL', 'pg_isready -U postgres'], interval: '2s', timeout: '3s', retries: 30 },
    },
    redis: {
      image: 'redis:7-alpine',
      network_mode: 'service:postgres',
      healthcheck: { test: ['CMD', 'redis-cli', 'ping'], interval: '2s', timeout: '3s', retries: 30 },
    },
    backend: {
      build: './backend', network_mode: 'service:postgres',
      environment: {
        NODE_ENV: 'test', DATABASE_URL: dbUrl, TEST_DATABASE_URL: dbUrl,
        TEST_REDIS_URL: 'redis://127.0.0.1:6379/0', BILLING_TEST_LIMITS_ENABLED: 'false',
      },
    },
    frontend: {
      build: './frontend',
      environment: {
        NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_API_URL: 'https://api.example.invalid',
        NEXT_PUBLIC_PADDLE_ENV: 'sandbox',
      },
    },
  },
}, null, 2));
writeFileSync(resolve(directory, 'compose.env'), '# No application secrets\n');
const base = ['compose', '--env-file', resolve(directory, 'compose.env'), '-p', project, '-f', resolve(directory, 'compose.json')];
function compose(args, logName) {
  const result = spawnSync('docker', [...base, ...args], {
    cwd: root, encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  writeFileSync(resolve(directory, logName), output);
  if (result.error || result.status !== 0) {
    throw new Error(`Failed: ${args.join(' ')}. See ${resolve(directory, logName)}\n${output.slice(-6000)}`, { cause: result.error });
  }
  console.log(`${args.join(' ')}: passed (${logName})`);
}
console.log(`Isolated Linux CI check: ${project}`);
console.log(`Logs: ${directory}`);
try {
  compose(['config', '--quiet'], 'config.log');
  compose(['build', 'backend', 'frontend'], 'build.log');
  compose(['up', '-d', '--wait', 'postgres', 'redis'], 'services.log');
  compose(['run', '--rm', '--no-deps', 'backend'], 'backend.log');
  compose(['run', '--rm', '--no-deps', 'frontend'], 'frontend.log');
  console.log('Linux CI commands passed. This is not a GitHub-hosted workflow run.');
} finally {
  // Generated project owns all resources; no host ports or app mounts are used.
  compose(['down', '--volumes', '--remove-orphans', '--rmi', 'local'], 'cleanup.log');
}
