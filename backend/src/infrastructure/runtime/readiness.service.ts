import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { getRedisConnection } from '../queue/redis-connection';
import { RuntimeState } from './runtime-state';

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  // Dedicated bounded connections keep health probes out of business queues.
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 1000,
    query_timeout: 1000,
    statement_timeout: 1000,
    idleTimeoutMillis: 5000,
  });
  private readonly redis = new Redis({
    ...getRedisConnection(),
    connectTimeout: 1000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => 1000,
  });
  private pending?: Promise<boolean>;
  private lastCheck = 0;
  private lastResult = false;

  constructor(private readonly state: RuntimeState) {
    this.pool.on('error', () => {
      this.lastResult = false;
    });
    this.redis.on('error', () => {
      this.lastResult = false;
    });
  }

  async check() {
    if (!this.state.ready || this.state.draining) return false;
    if (Date.now() - this.lastCheck < 1000) return this.lastResult;
    this.pending ??= Promise.allSettled([
      this.pool.query('SELECT 1'),
      this.redis.ping(),
    ])
      .then((results) => {
        this.lastResult = results.every(
          (result) => result.status === 'fulfilled',
        );
        this.lastCheck = Date.now();
        return this.lastResult;
      })
      .finally(() => {
        this.pending = undefined;
      });
    const result = await this.pending;
    return result && this.state.ready && !this.state.draining;
  }

  async onModuleDestroy() {
    this.redis.disconnect();
    await this.pool.end();
  }
}
