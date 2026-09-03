const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const dotenv = require('dotenv');

const backendRoot = resolve(__dirname, '..');
const environmentPath = resolve(backendRoot, '.env');
const fileEnvironment = existsSync(environmentPath)
  ? dotenv.parse(readFileSync(environmentPath))
  : {};
const primaryDatabaseUrl =
  process.env.COREASSIST_PRIMARY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  fileEnvironment.DATABASE_URL;
const explicitTestDatabaseUrl =
  process.env.TEST_DATABASE_URL || fileEnvironment.TEST_DATABASE_URL;
const testDatabaseUrl =
  explicitTestDatabaseUrl || deriveLocalTestDatabaseUrl(primaryDatabaseUrl);

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required when DATABASE_URL does not point to localhost.',
  );
}

assertSafeTestDatabaseUrl(testDatabaseUrl, primaryDatabaseUrl);

process.env.COREASSIST_PRIMARY_DATABASE_URL = primaryDatabaseUrl || '';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.CATALOG_CONNECTOR_MODE = 'live';
process.env.QUESTION_CONNECTOR_MODE = 'live';

module.exports = {
  backendRoot,
  primaryDatabaseUrl,
  testDatabaseUrl,
};

function deriveLocalTestDatabaseUrl(value) {
  if (!value) return null;

  const url = parsePostgresUrl(value, 'DATABASE_URL');
  if (!isLocalHost(url.hostname)) return null;

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  url.pathname = `/${encodeURIComponent(`${databaseName}_test`)}`;
  return url.toString();
}

function assertSafeTestDatabaseUrl(testValue, primaryValue) {
  const testUrl = parsePostgresUrl(testValue, 'TEST_DATABASE_URL');
  const databaseName = decodeURIComponent(testUrl.pathname.slice(1));

  if (!databaseName || !/(?:^|[_-])test(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      'TEST_DATABASE_URL database name must contain a standalone "test" segment.',
    );
  }

  if (primaryValue && normalizeUrl(testValue) === normalizeUrl(primaryValue)) {
    throw new Error('TEST_DATABASE_URL cannot be the same as DATABASE_URL.');
  }
}

function parsePostgresUrl(value, label) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${label} must use the postgresql protocol.`);
  }

  return url;
}

function normalizeUrl(value) {
  const url = parsePostgresUrl(value, 'Database URL');
  url.hash = '';
  return url.toString();
}

function isLocalHost(hostname) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}
