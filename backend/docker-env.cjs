// Loaded before application/Prisma imports. Secrets stay outside image layers.
const fs = require('node:fs');
const dotenv = require('dotenv');
if (process.env.APP_ENV_FILE) {
  const values = dotenv.parse(fs.readFileSync(process.env.APP_ENV_FILE));
  for (const [key, value] of Object.entries(values)) {
    // Deployment settings explicitly provided by Compose take precedence.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
if (process.env.POSTGRES_PASSWORD_FILE) {
  const password = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE, 'utf8').trim();
  if (!password) throw new Error('Empty PostgreSQL password file.');
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || 'core_assist')}:${encodeURIComponent(password)}@postgres:5432/${encodeURIComponent(process.env.POSTGRES_DB || 'core_assist')}`;
}
if (process.env.REDIS_PASSWORD_FILE) {
  const password = fs.readFileSync(process.env.REDIS_PASSWORD_FILE, 'utf8').trim();
  if (!password) throw new Error('Empty Redis password file.');
  process.env.REDIS_URL = `redis://:${encodeURIComponent(password)}@redis:6379/0`;
}
