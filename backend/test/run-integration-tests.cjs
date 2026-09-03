const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');
const { backendRoot, testDatabaseUrl } = require('./test-database-env.cjs');

async function run() {
  await ensureLocalTestDatabaseExists(testDatabaseUrl);

  runNode(
    require.resolve('prisma/build/index.js'),
    ['migrate', 'deploy'],
    'Test database migrations failed.',
  );
  runNode(
    join(backendRoot, 'node_modules', 'jest', 'bin', 'jest.js'),
    ['--config', 'test/jest-integration.json', '--runInBand'],
    'Integration tests failed.',
    ['--experimental-vm-modules'],
  );
}

async function ensureLocalTestDatabaseExists(connectionString) {
  const target = new URL(connectionString);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(connectionString);
  maintenance.pathname = '/postgres';
  maintenance.search = '';
  const client = new Client({ connectionString: maintenance.toString() });

  try {
    await client.connect();
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );

    if (result.rowCount === 0) {
      if (!isLocalHost(target.hostname)) {
        throw new Error(
          'The configured remote test database does not exist; create it explicitly before running tests.',
        );
      }

      if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
        throw new Error(
          'The derived test database name contains unsafe characters.',
        );
      }

      await client.query(`CREATE DATABASE "${databaseName}"`);
      process.stdout.write(`Created isolated test database: ${databaseName}\n`);
    }
  } finally {
    await client.end();
  }
}

function runNode(entrypoint, args, failureMessage, nodeArgs = []) {
  if (!existsSync(entrypoint)) {
    throw new Error(`Required executable was not found: ${entrypoint}`);
  }

  const result = spawnSync(
    process.execPath,
    [...nodeArgs, entrypoint, ...args],
    {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(failureMessage);
}

function isLocalHost(hostname) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

void run().catch((error) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
