import type { RedisOptions } from 'bullmq';

export function getRedisConnection(): RedisOptions {
  const configuredUrl = process.env.REDIS_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'REDIS_URL environment variable is required in production.',
      );
    }

    return { host: '127.0.0.1', port: 6379 };
  }

  const url = new URL(configuredUrl);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol.');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}
