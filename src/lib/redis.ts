import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL)

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Redis channels for real-time updates
export const REDIS_CHANNELS = {
  QUEUE_UPDATES: 'queue:updates',
  WORKER_UPDATES: 'worker:updates',
  RESULT_UPDATES: 'result:updates',
  STATS_UPDATES: 'stats:updates',
} as const

export default redis 