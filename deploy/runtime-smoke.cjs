// Mounted only into the isolated Docker test. No real provider calls.
require('reflect-metadata');
const { Module, Logger } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { BullModule, WorkerHost, Processor, getQueueToken } = require('@nestjs/bullmq');
const { get } = require('node:http');
const { RuntimeModule } = require('./dist/src/infrastructure/runtime/runtime.module');
const { RuntimeState } = require('./dist/src/infrastructure/runtime/runtime-state');
const { installShutdownHandlers } = require('./dist/src/infrastructure/runtime/graceful-shutdown');
const { PrismaModule } = require('./dist/src/database/prisma.module');
const { PrismaService } = require('./dist/src/database/prisma.service');
const { getRedisConnection } = require('./dist/src/infrastructure/queue/redis-connection');
const { NotificationStreamService } = require('./dist/src/modules/notifications/notification-stream.service');
const { NotificationRetentionService } = require('./dist/src/modules/notifications/notification-retention.service');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let prisma, started = 0;
function ready() { if (++started === 3) console.log('READY_FOR_SIGNAL'); }
class ProbeWorker extends WorkerHost {
  async process() {
    ready();
    await delay(5000);
    await prisma.$executeRawUnsafe("INSERT INTO ops_restore_probe VALUES ('worker-drained')");
  }
}
Processor('ops-shutdown-probe')(ProbeWorker);
class ProbeModule {}
Module({
  imports: [RuntimeModule, PrismaModule, BullModule.forRoot({ connection: getRedisConnection() }), BullModule.registerQueue({ name: 'ops-shutdown-probe' })],
  providers: [ProbeWorker, NotificationStreamService, { provide: NotificationRetentionService, useValue: { stopAndDrain: () => Promise.resolve() } }],
})(ProbeModule);

(async () => {
  const app = await NestFactory.create(ProbeModule, { logger: false });
  prisma = app.get(PrismaService);
  app.getHttpAdapter().get('/slow', async (_req, res) => {
    ready();
    await delay(5000);
    await prisma.$executeRawUnsafe("INSERT INTO ops_restore_probe VALUES ('http-drained')");
    res.end('done');
  });
  app.getHttpAdapter().get('/events', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    const subscription = app.get(NotificationStreamService).forUser('test-only', null).subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event.data)}\n\n`),
      complete: () => res.end(),
    });
    res.on('close', () => subscription.unsubscribe());
    ready();
  });
  await app.listen(4001);
  app.get(RuntimeState).ready = true;
  installShutdownHandlers(app, new Logger('Probe'));
  await app.get(getQueueToken('ops-shutdown-probe')).add('probe', {});
  get('http://127.0.0.1:4001/slow', (response) => response.resume()).on('error', () => {});
  get('http://127.0.0.1:4001/events', (response) => response.resume()).on('error', () => {});
})().catch((error) => { console.error(error); process.exit(1); });
