import { QueueItem, Worker, ScrapingResult, SystemStats } from '@/types/scraper'
import { prisma } from './database'
import { publishUpdate } from './realtime'
import { redis } from './redis'

export class DatabaseStore {
  private systemStartTime = Date.now()

  constructor() {
    this.initializeSystemStats()
  }

  private async initializeSystemStats() {
    try {
      await prisma.systemStats.upsert({
        where: { id: 'system-stats' },
        update: { uptime: Math.floor((Date.now() - this.systemStartTime) / 1000) },
        create: { id: 'system-stats', uptime: 0 }
      })
    } catch (error) {
      console.error('Failed to initialize system stats:', error)
    }
  }

  // Queue management
  async getQueue(limit?: number): Promise<QueueItem[]> {
    const items = await prisma.queueItem.findMany({
      orderBy: { addedAt: 'desc' },
      take: limit,
      include: { worker: true }
    })
    
    return items.map(this.mapQueueItem)
  }

  async addToQueue(url: string, type: 'profile' | 'video' = 'profile'): Promise<QueueItem> {
    const item = await prisma.queueItem.create({
      data: {
        url,
        type: type.toUpperCase() as any,
        status: 'PENDING'
      }
    })
    
    const queueItem = this.mapQueueItem(item)
    await publishUpdate({
      type: 'queue',
      action: 'create',
      data: queueItem,
      timestamp: Date.now()
    })
    
    return queueItem
  }

  async updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<QueueItem | null> {
    try {
      const item = await prisma.queueItem.update({
        where: { id },
        data: {
          ...updates,
          status: updates.status?.toUpperCase() as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
          type: updates.type?.toUpperCase() as any,
          startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
          completedAt: updates.completedAt ? new Date(updates.completedAt) : undefined,
        },
        include: { worker: true }
      })
      
      // Release Redis lock when task is completed or failed
      const finalStatus = updates.status?.toLowerCase()
      if (finalStatus === 'completed' || finalStatus === 'failed') {
        await this.releaseTaskLock(id)
      }
      
      const queueItem = this.mapQueueItem(item)
      await publishUpdate({
        type: 'queue',
        action: 'update',
        data: queueItem,
        timestamp: Date.now()
      })
      
      return queueItem
    } catch (error) {
      console.error('Failed to update queue item:', error)
      return null
    }
  }

  async releaseTaskLock(taskId: string): Promise<void> {
    try {
      const lockKey = `task_lock:${taskId}`
      const result = await redis.del(lockKey)
      if (result > 0) {
        console.log(`🔓 Released lock for task ${taskId}`)
      }
    } catch (error) {
      console.error(`Failed to release lock for task ${taskId}:`, error)
    }
  }

  async cleanupOrphanedLocks(): Promise<number> {
    try {
      // Find all Redis task locks
      const lockKeys = await redis.keys('task_lock:*')
      let cleaned = 0

      for (const lockKey of lockKeys) {
        const taskId = lockKey.replace('task_lock:', '')
        
        // Check if the task still exists and is processing
        const task = await prisma.queueItem.findUnique({
          where: { id: taskId },
          select: { status: true }
        })

        // If task doesn't exist or is not processing, release the lock
        if (!task || task.status !== 'PROCESSING') {
          const result = await redis.del(lockKey)
          if (result > 0) {
            console.log(`🧹 Cleaned orphaned lock for task ${taskId}`)
            cleaned++
          }
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleanup complete: removed ${cleaned} orphaned locks`)
      }
      
      return cleaned
    } catch (error) {
      console.error('Failed to cleanup orphaned locks:', error)
      return 0
    }
  }

  async removeFromQueue(id: string): Promise<boolean> {
    try {
      // First delete related ScrapingResults and VideoData
      const scrapingResults = await prisma.scrapingResult.findMany({
        where: { queueItemId: id }
      })
      
      for (const result of scrapingResults) {
        // Delete VideoData first
        await prisma.videoData.deleteMany({
          where: { resultId: result.id }
        })
        
        // Then delete ScrapingResult
        await prisma.scrapingResult.delete({
          where: { id: result.id }
        })
      }
      
      // Finally delete the QueueItem
      await prisma.queueItem.delete({ where: { id } })
      
      await publishUpdate({
        type: 'queue',
        action: 'delete',
        data: { id },
        timestamp: Date.now()
      })
      return true
    } catch (error) {
      console.error('Failed to remove queue item:', error)
      return false
    }
  }

  async getNextPendingItem(): Promise<QueueItem | null> {
    // Get all pending items to try claiming them atomically
    const pendingItems = await prisma.queueItem.findMany({
      where: { status: 'PENDING' },
      orderBy: { addedAt: 'asc' },
      take: 10, // Try up to 10 pending items to find one we can claim
      include: { worker: true }
    })

    if (pendingItems.length === 0) {
      return null
    }

    // Try to atomically claim each pending item using Redis distributed lock
    for (const item of pendingItems) {
      const lockKey = `task_lock:${item.id}`
      const lockValue = `worker_${Date.now()}_${Math.random()}`
      
      try {
        // Try to acquire distributed lock with 10 minute expiration
        const lockAcquired = await redis.set(lockKey, lockValue, 'PX', 600000, 'NX')
        
        if (lockAcquired === 'OK') {
          console.log(`🔒 Worker acquired lock for task ${item.id}: ${item.url}`)
          
          // Double-check the item is still pending and update it to processing
          try {
            const updatedItem = await prisma.queueItem.update({
              where: { 
                id: item.id,
                status: 'PENDING' // Only update if still pending
              },
              data: { 
                status: 'PROCESSING',
                startedAt: new Date()
              },
              include: { worker: true }
            })
            
            console.log(`✅ Successfully claimed and marked task ${item.id} as processing`)
            return this.mapQueueItem(updatedItem)
            
          } catch (updateError) {
            // Failed to update (probably already taken), release the lock and try next
            console.log(`⚠️ Failed to update task ${item.id}, releasing lock and trying next`)
            await redis.del(lockKey)
            continue
          }
        } else {
          // Lock not acquired, task is being processed by another worker
          console.log(`🔒 Task ${item.id} is locked by another worker, trying next`)
          continue
        }
      } catch (redisError) {
        console.error(`Redis error while trying to lock task ${item.id}:`, redisError)
        continue
      }
    }

    // No tasks could be claimed
    console.log('📭 No pending tasks available for claiming')
    return null
  }

  // Worker management
  async getWorkers(): Promise<Worker[]> {
    const workers = await prisma.worker.findMany({
      orderBy: { name: 'asc' }
    })
    
    return workers.map(this.mapWorker)
  }

  async getWorker(id: string): Promise<Worker | null> {
    const worker = await prisma.worker.findUnique({ where: { id } })
    return worker ? this.mapWorker(worker) : null
  }

  async updateWorker(id: string, updates: Partial<Worker>): Promise<Worker | null> {
    try {
      const worker = await prisma.worker.update({
        where: { id },
        data: {
          ...updates,
          status: updates.status?.toUpperCase() as 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR',
          lastActivity: new Date(),
          startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
        }
      })
      
      const workerData = this.mapWorker(worker)
      await publishUpdate({
        type: 'worker',
        action: 'update',
        data: workerData,
        timestamp: Date.now()
      })
      
      return workerData
    } catch (error) {
      console.error('Failed to update worker:', error)
      return null
    }
  }

  async addWorker(name: string): Promise<Worker> {
    const worker = await prisma.worker.create({
      data: {
        name,
        status: 'IDLE',
        processedCount: 0
      }
    })
    
    const workerData = this.mapWorker(worker)
    await publishUpdate({
      type: 'worker',
      action: 'create',
      data: workerData,
      timestamp: Date.now()
    })
    
    return workerData
  }

  async removeWorker(id: string): Promise<boolean> {
    try {
      // Get worker info before deletion
      const worker = await prisma.worker.findUnique({ where: { id } })
      if (!worker) {
        console.error('Worker not found:', id)
        return false
      }

      // Send shutdown command to the worker via Redis
      try {
        await redis.publish(`worker:${worker.name}:control`, JSON.stringify({
          action: 'shutdown',
          timestamp: Date.now()
        }))
        console.log(`Shutdown signal sent to worker: ${worker.name}`)
        
        // Give the worker a moment to receive the shutdown signal
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (redisError) {
        console.error('Failed to send shutdown signal to worker:', redisError)
        // Continue with deletion even if Redis command fails
      }

      // Remove worker from database
      await prisma.worker.delete({ where: { id } })
      
      // Publish realtime update for UI
      await publishUpdate({
        type: 'worker',
        action: 'delete',
        data: { id },
        timestamp: Date.now()
      })
      
      return true
    } catch (error) {
      console.error('Failed to remove worker:', error)
      return false
    }
  }

  // Results management
  async getResults(): Promise<ScrapingResult[]> {
    const results = await prisma.scrapingResult.findMany({
      orderBy: { completedAt: 'desc' },
      include: {
        queueItem: true,
        videoData: true
      }
    })
    
    return results.map(this.mapResult)
  }

  async saveResults(queueItemId: string, videoData: any[]): Promise<ScrapingResult> {
    // Get the queue item to extract URL and other info
    const queueItem = await prisma.queueItem.findUnique({ 
      where: { id: queueItemId } 
    })
    
    if (!queueItem) {
      throw new Error(`Queue item not found: ${queueItemId}`)
    }

    // Extract username from URL
    const urlMatch = queueItem.url.match(/@([^\/\?]+)/)
    const username = urlMatch ? urlMatch[1] : 'unknown'

    // Convert the scraped video data to the expected format
    const convertedVideoData = videoData.map(video => {
      const converted = {
        videoId: video.video_url?.split('/video/')[1]?.split('?')[0] || 'unknown',
        url: video.video_url || '',
        description: video.description || '', // Now available from scraper output
        likes: video.likes || 0,
        shares: 0, // Not available in current scraper output
        comments: video.comments || 0,
        views: video.views || 0,
        uploadDate: video.upload_date || undefined, // Now available from scraper output
        hashtags: video.hashtags || [], // Now available from scraper output
        mentions: video.mentions || [], // Now available from scraper output
        commentTexts: video.comments_list || [], // Now available from scraper output
        duration: video.duration || undefined // Now available from scraper output
      }
      
      // Debug: Log conversion for first video
      if (videoData.indexOf(video) === 0) {
        console.log('🔍 DEBUG: Converting video data:', {
          originalKeys: Object.keys(video),
          original: {
            description: video.description,
            duration: video.duration,
            upload_date: video.upload_date,
            hashtags: video.hashtags,
            mentions: video.mentions,
            comments_list: video.comments_list?.length || 0
          },
          converted: {
            description: converted.description,
            duration: converted.duration,
            uploadDate: converted.uploadDate,
            hashtags: converted.hashtags,
            mentions: converted.mentions,
            commentTexts: converted.commentTexts?.length || 0
          }
        })
      }
      
      return converted
    })

    const result = {
      queueItemId,
      url: queueItem.url,
      username,
      totalVideos: videoData.length,
      successfulVideos: videoData.length,
      failedVideos: 0,
      csvFilePath: undefined, // CSV is handled separately if needed
      processingTime: 0, // Could be calculated from queue item timestamps
      completedAt: new Date().toISOString(),
      videoData: convertedVideoData
    }

    return this.addResult(result)
  }

  async addResult(result: Omit<ScrapingResult, 'id'>): Promise<ScrapingResult> {
    const newResult = await prisma.scrapingResult.create({
      data: {
        queueItemId: result.queueItemId,
        url: result.url,
        username: result.username,
        totalVideos: result.totalVideos,
        successfulVideos: result.successfulVideos,
        failedVideos: result.failedVideos,
        csvFilePath: result.csvFilePath,
        processingTime: result.processingTime,
        videoData: {
          create: result.videoData?.map(video => ({
            videoId: video.videoId,
            url: video.url,
            description: video.description,
            likes: video.likes,
            shares: video.shares,
            comments: video.comments,
            views: video.views,
            duration: video.duration,
            uploadDate: video.uploadDate ? new Date(video.uploadDate) : null,
            hashtags: video.hashtags,
            mentions: video.mentions,
            commentTexts: video.commentTexts
          })) || []
        }
      },
      include: {
        queueItem: true,
        videoData: true
      }
    })
    
    const resultData = this.mapResult(newResult)
    await publishUpdate({
      type: 'result',
      action: 'create',
      data: resultData,
      timestamp: Date.now()
    })
    
    return resultData
  }

  // Statistics
  async getStats(): Promise<SystemStats> {
    const now = Date.now()
    const uptime = Math.floor((now - this.systemStartTime) / 1000)
    
    const [queueStats, workerStats] = await Promise.all([
      prisma.queueItem.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.worker.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ])
    
    const stats = {
      totalQueued: queueStats.find(s => s.status === 'PENDING')?._count.status || 0,
      totalProcessing: queueStats.find(s => s.status === 'PROCESSING')?._count.status || 0,
      totalCompleted: queueStats.find(s => s.status === 'COMPLETED')?._count.status || 0,
      totalFailed: queueStats.find(s => s.status === 'FAILED')?._count.status || 0,
      activeWorkers: workerStats.find(s => s.status === 'RUNNING')?._count.status || 0,
      totalWorkers: workerStats.reduce((sum, s) => sum + s._count.status, 0),
      uptime,
    }
    
    // Update database stats
    try {
      await prisma.systemStats.upsert({
        where: { id: 'system-stats' },
        update: { uptime },
        create: { id: 'system-stats', uptime }
      })
    } catch (error) {
      console.error('Failed to update system stats:', error)
    }
    
    return stats
  }

  // Mapping functions
  private mapQueueItem(item: any): QueueItem {
    return {
      id: item.id,
      url: item.url,
      type: item.type.toLowerCase() as 'profile' | 'video',
      status: item.status.toLowerCase() as QueueItem['status'],
      addedAt: item.addedAt.toISOString(),
      startedAt: item.startedAt?.toISOString(),
      completedAt: item.completedAt?.toISOString(),
      error: item.error,
      progress: item.progress,
      videosFound: item.videosFound,
      videosProcessed: item.videosProcessed,
    }
  }

  private mapWorker(worker: any): Worker {
    return {
      id: worker.id,
      name: worker.name,
      status: worker.status.toLowerCase() as Worker['status'],
      processedCount: worker.processedCount,
      startedAt: worker.startedAt?.toISOString(),
      lastActivity: worker.lastActivity?.toISOString(),
      errorMessage: worker.errorMessage,
    }
  }

  private mapResult(result: any): ScrapingResult {
    return {
      id: result.id,
      queueItemId: result.queueItemId,
      url: result.url,
      username: result.username,
      totalVideos: result.totalVideos,
      successfulVideos: result.successfulVideos,
      failedVideos: result.failedVideos,
      csvFilePath: result.csvFilePath,
      completedAt: result.completedAt.toISOString(),
      processingTime: result.processingTime,
      videoData: result.videoData?.map((video: any) => ({
        videoId: video.videoId,
        url: video.url,
        description: video.description,
        likes: video.likes,
        shares: video.shares,
        comments: video.comments,
        views: video.views,
        duration: video.duration,
        uploadDate: video.uploadDate?.toISOString(),
        hashtags: video.hashtags,
        mentions: video.mentions,
        commentTexts: video.commentTexts
      })) || []
    }
  }
}

export const databaseStore = new DatabaseStore() 