import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisConnection } from '../../infrastructure/queue/redis-connection';
import type { RequestWithAuth } from '../auth/auth.types';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 20;
const RATE_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return {count, redis.call('PTTL', KEYS[1])}
`;

@Injectable()
export class SupportImageRateLimitGuard
  implements CanActivate, OnModuleDestroy
{
  private readonly redis = new Redis({
    ...getRedisConnection(),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 1000,
    commandTimeout: 1000,
  });

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user) throw new UnauthorizedException();
    await enforceSupportImageRateLimit(this.redis, request.user.id);
    return true;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}

export async function enforceSupportImageRateLimit(
  client: Pick<Redis, 'eval'>,
  userId: string,
) {
  const [count, remainingMs] = (await client.eval(
    RATE_SCRIPT,
    1,
    `coreassist:support:image-upload:${userId}`,
    String(WINDOW_MS),
  )) as [number, number];
  if (count > MAX_UPLOADS_PER_WINDOW) {
    throw new HttpException(
      {
        message: 'Çok fazla görsel yüklediniz. Biraz sonra tekrar deneyin.',
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
