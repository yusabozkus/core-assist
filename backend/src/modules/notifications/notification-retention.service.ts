import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_CLEANUP_INTERVAL_MS = DAY_IN_MS;

@Injectable()
export class NotificationRetentionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationRetentionService.name);
  private cleanupTimer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const intervalMs = this.readPositiveNumber(
      process.env.NOTIFICATION_CLEANUP_INTERVAL_MS,
      DEFAULT_CLEANUP_INTERVAL_MS,
    );

    this.cleanupTimer = setInterval(() => {
      this.runCleanup();
    }, intervalMs);
    this.cleanupTimer.unref();

    this.runCleanup();
  }

  async stopAndDrain() {
    this.stopped = true;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.running;
  }

  async onModuleDestroy() {
    await this.stopAndDrain();
  }

  private runCleanup() {
    if (this.stopped || this.running) return;
    this.running = this.removeExpiredNotifications().finally(() => {
      this.running = undefined;
    });
  }

  private async removeExpiredNotifications() {
    const retentionDays = this.readPositiveNumber(
      process.env.NOTIFICATION_RETENTION_DAYS,
      DEFAULT_RETENTION_DAYS,
    );
    const cutoff = new Date(Date.now() - retentionDays * DAY_IN_MS);

    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          readAt: { not: null },
          lastOccurredAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `${result.count} eski bildirim kalıcı olarak temizlendi.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.warn(`Bildirim saklama temizliği tamamlanamadı: ${message}`);
    }
  }

  private readPositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
