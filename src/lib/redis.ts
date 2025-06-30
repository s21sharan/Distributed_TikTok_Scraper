import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Redis channels for real-time updates
export const REDIS_CHANNELS = {
  QUEUE_UPDATES: 'queue:updates',
  WORKER_UPDATES: 'worker:updates',
  RESULT_UPDATES: 'result:updates',
  STATS_UPDATES: 'stats:updates',
} as const

export default redis 