import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isRedisEnabled = !!(redisUrl && redisToken);

export const redis = isRedisEnabled
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

if (!isRedisEnabled) {
  console.warn(
    'Redis environment variables (UPSTASH_REDIS_REST_URL/TOKEN) are missing. Falling back to Postgres for Idempotency.'
  );
}
