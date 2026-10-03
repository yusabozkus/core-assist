import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import {
  filter,
  interval,
  map,
  merge,
  Observable,
  of,
  Subject,
  takeUntil,
} from 'rxjs';
import { getRedisConnection } from '../../infrastructure/queue/redis-connection';
import { RuntimeState } from '../../infrastructure/runtime/runtime-state';

export type NotificationChangeReason =
  'CREATED' | 'READ' | 'READ_ALL' | 'DELETED';

type NotificationChange = {
  recipientUserId: string;
  storeId: string | null;
  reason: NotificationChangeReason;
  occurredAt: string;
};

type DistributedNotificationChange = NotificationChange & {
  sourceId: string;
};

const NOTIFICATION_CHANGES_CHANNEL = 'coreassist:notifications:changes';

@Injectable()
export class NotificationStreamService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationStreamService.name);
  private readonly changes = new Subject<NotificationChange>();
  private readonly sourceId = randomUUID();
  private readonly publisher = new Redis(getRedisConnection());
  private readonly subscriber = new Redis(getRedisConnection());

  constructor(private readonly runtime: RuntimeState) {}

  async onModuleInit() {
    this.publisher.on('error', (error) => {
      this.logger.warn(`Bildirim yayın bağlantısı hatası: ${error.message}`);
    });
    this.subscriber.on('error', (error) => {
      this.logger.warn(`Bildirim dinleme bağlantısı hatası: ${error.message}`);
    });
    this.subscriber.on('message', (channel, payload) => {
      if (channel !== NOTIFICATION_CHANGES_CHANNEL) return;

      try {
        const change = JSON.parse(payload) as DistributedNotificationChange;
        if (change.sourceId === this.sourceId) return;
        this.changes.next(change);
      } catch {
        this.logger.warn('Geçersiz bildirim akışı mesajı yok sayıldı.');
      }
    });

    try {
      await this.subscriber.subscribe(NOTIFICATION_CHANGES_CHANNEL);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.warn(
        `Dağıtık bildirim akışı başlatılamadı, yerel akış kullanılacak: ${message}`,
      );
    }
  }

  forUser(userId: string, storeId: string | null): Observable<MessageEvent> {
    const connected: MessageEvent = {
      data: {
        kind: 'CONNECTED',
        storeId,
        occurredAt: new Date().toISOString(),
      },
    };

    const changes = this.changes.pipe(
      filter(
        (change) =>
          change.recipientUserId === userId &&
          (storeId === null
            ? change.storeId === null
            : change.storeId === storeId || change.storeId === null),
      ),
      map((change): MessageEvent => ({
        data: { kind: 'CHANGED', ...change },
      })),
    );

    const heartbeat = interval(25_000).pipe(
      map((): MessageEvent => ({
        data: { kind: 'HEARTBEAT', occurredAt: new Date().toISOString() },
      })),
    );

    return merge(of(connected), changes, heartbeat).pipe(
      takeUntil(this.runtime.stopped),
    );
  }

  emit(
    recipientUserIds: Iterable<string>,
    storeId: string | null,
    reason: NotificationChangeReason,
  ) {
    const occurredAt = new Date().toISOString();
    for (const recipientUserId of recipientUserIds) {
      const change: NotificationChange = {
        recipientUserId,
        storeId,
        reason,
        occurredAt,
      };
      this.changes.next(change);
      void this.publisher
        .publish(
          NOTIFICATION_CHANGES_CHANNEL,
          JSON.stringify({ ...change, sourceId: this.sourceId }),
        )
        .catch((error: Error) => {
          this.logger.warn(
            `Bildirim değişikliği yayınlanamadı: ${error.message}`,
          );
        });
    }
  }

  onModuleDestroy() {
    this.changes.complete();
    // HTTP/workers have drained; do not wait indefinitely for offline Redis.
    this.subscriber.disconnect();
    this.publisher.disconnect();
  }
}
