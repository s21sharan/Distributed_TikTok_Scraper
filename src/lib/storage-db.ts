import { QueueItem, Worker, ScrapingResult, SystemStats } from '@/types/scraper'
import { prisma } from './database'
import { publishUpdate } from './realtime'

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
          status: updates.status?.toUpperCase() as any,
          startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
          completedAt: updates.completedAt ? new Date(updates.completedAt) : undefined,
        },
        include: { worker: true }
      })
      
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

  async removeFromQueue(id: string): Promise<boolean> {
    try {
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
    const item = await prisma.queueItem.findFirst({
      where: { status: 'PENDING' },
      orderBy: { addedAt: 'asc' },
      include: { worker: true }
    })
    
    return item ? this.mapQueueItem(item) : null
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
          status: updates.status?.toUpperCase() as any,
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
      await prisma.worker.delete({ where: { id } })
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
            mentions: video.mentions
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
        mentions: video.mentions
      })) || []
    }
  }
}

export const databaseStore = new DatabaseStore() 