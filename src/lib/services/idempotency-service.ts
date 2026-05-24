import { prisma } from '../prisma';
import { redis, isRedisEnabled } from '../redis';

interface IdempotencyResponse {
  statusCode: number;
  responseBody: unknown;
}

export class IdempotencyService {
  private static getRedisKey(key: string, endpoint: string): string {
    return `idempotency:${endpoint}:${key}`;
  }

  /**
   * Retrieves a stored response for a given idempotency key and endpoint.
   */
  static async get(key: string, endpoint: string): Promise<IdempotencyResponse | null> {
    if (!key) return null;

    // 1. Try Redis first
    if (isRedisEnabled && redis) {
      try {
        const redisKey = this.getRedisKey(key, endpoint);
        const cached = await redis.get<string>(redisKey);
        if (cached) {
          // If cached is already an object or string
          const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return {
            statusCode: parsed.statusCode,
            responseBody: parsed.responseBody,
          };
        }
      } catch (err) {
        console.error('Redis error in IdempotencyService.get, falling back to DB:', err);
      }
    }

    // 2. Fallback to Postgres
    try {
      const stored = await prisma.idempotencyKey.findUnique({
        where: {
          key_endpoint: {
            key,
            endpoint,
          },
        },
      });

      if (stored) {
        return {
          statusCode: stored.statusCode,
          responseBody: stored.responseBody,
        };
      }
    } catch (err) {
      console.error('Database error in IdempotencyService.get:', err);
    }

    return null;
  }

  /**
   * Stores a response for a given idempotency key and endpoint.
   * TTL of 24 hours (86400 seconds).
   */
  static async store(
    key: string,
    endpoint: string,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    if (!key) return;

    // 1. Store in Redis
    let redisStored = false;
    if (isRedisEnabled && redis) {
      try {
        const redisKey = this.getRedisKey(key, endpoint);
        const payload = JSON.stringify({ statusCode, responseBody });
        await redis.set(redisKey, payload, { ex: 86400 });
        redisStored = true;
      } catch (err) {
        console.error('Redis error in IdempotencyService.store:', err);
      }
    }

    // 2. Also store in PostgreSQL database (essential as the source of truth or fallback)
    try {
      // Use upsert to avoid duplicate keys issues in Postgres
      await prisma.idempotencyKey.upsert({
        where: {
          key_endpoint: {
            key,
            endpoint,
          },
        },
        create: {
          key,
          endpoint,
          statusCode,
          responseBody: responseBody || {},
        },
        update: {
          statusCode,
          responseBody: responseBody || {},
        },
      });
    } catch (err) {
      console.error('Database error in IdempotencyService.store:', err);
      // If we failed to store in DB but stored in Redis, that's partially fine,
      // but if both fail, we should throw so the caller knows the transaction shouldn't commit or be marked idempotent.
      if (!redisStored) {
        throw new Error('Failed to persist idempotency key in both Redis and Database.');
      }
    }
  }
}
