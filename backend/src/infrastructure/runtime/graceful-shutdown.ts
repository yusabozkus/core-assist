import type { INestApplication, LoggerService } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import type { Server } from 'node:http';
import { RuntimeState } from './runtime-state';
import { NotificationRetentionService } from '../../modules/notifications/notification-retention.service';

export const SHUTDOWN_TIMEOUT_MS = 150_000;

// Drain before app.close(): Nest destroys providers (including Prisma) before
// BullMQ's onApplicationShutdown hook would normally finish active workers.
export async function drainApplication(app: INestApplication) {
  app.get(RuntimeState).beginShutdown();
  const server = app.getHttpServer() as Server;
  const httpClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (
        error &&
        (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING'
      )
        reject(error);
      else resolve();
    });
  });
  const workers = app
    .get(DiscoveryService)
    .getProviders()
    .map((provider) => provider.instance as unknown)
    .filter(
      (instance): instance is WorkerHost => instance instanceof WorkerHost,
    );
  await Promise.all([
    httpClosed,
    app.get(NotificationRetentionService).stopAndDrain(),
    ...workers.map((host) => host.worker.close()),
  ]);
  await app.close();
}

export function installShutdownHandlers(
  app: INestApplication,
  logger: LoggerService,
) {
  let shutdown: Promise<void> | undefined;
  const handler = () => {
    if (shutdown) return;
    logger.log('Backend draining HTTP requests and workers.', 'Shutdown');
    const deadline = setTimeout(() => {
      logger.error(
        'Shutdown deadline exceeded; interrupted work requires recovery.',
        'Shutdown',
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    shutdown = drainApplication(app)
      .then(() => {
        clearTimeout(deadline);
        logger.log('Backend shutdown completed.', 'Shutdown');
        process.exit(0);
      })
      .catch(() => {
        clearTimeout(deadline);
        logger.error('Backend shutdown failed.', 'Shutdown');
        process.exit(1);
      });
  };
  // Explicit signal handling is intentional; do not also enable Nest's hooks.
  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
}
