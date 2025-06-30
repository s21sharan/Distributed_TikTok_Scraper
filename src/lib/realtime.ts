import { redis, REDIS_CHANNELS } from './redis'

export interface RealtimeUpdate {
  type: 'queue' | 'worker' | 'result' | 'stats'
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
}

export async function publishUpdate(update: RealtimeUpdate) {
  const channel = getChannelForType(update.type)
  await redis.publish(channel, JSON.stringify(update))
}

export function getChannelForType(type: RealtimeUpdate['type']): string {
  switch (type) {
    case 'queue':
      return REDIS_CHANNELS.QUEUE_UPDATES
    case 'worker':
      return REDIS_CHANNELS.WORKER_UPDATES
    case 'result':
      return REDIS_CHANNELS.RESULT_UPDATES
    case 'stats':
      return REDIS_CHANNELS.STATS_UPDATES
    default:
      throw new Error(`Unknown update type: ${type}`)
  }
}

export async function subscribeToUpdates(
  types: RealtimeUpdate['type'][],
  callback: (update: RealtimeUpdate) => void
) {
  const subscriber = redis.duplicate()
  
  const channels = types.map(getChannelForType)
  await subscriber.subscribe(...channels)
  
  subscriber.on('message', (channel, message) => {
    try {
      const update = JSON.parse(message) as RealtimeUpdate
      callback(update)
    } catch (error) {
      console.error('Failed to parse realtime update:', error)
    }
  })
  
  return subscriber
} 