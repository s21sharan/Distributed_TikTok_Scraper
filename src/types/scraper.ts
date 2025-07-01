export interface QueueItem {
  id: string
  url: string
  type: 'profile' | 'video'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  addedAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  progress?: number
  videosFound?: number
  videosProcessed?: number
}

export interface Worker {
  id: string
  name: string
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error'
  currentTask?: QueueItem
  processedCount: number
  startedAt?: string
  lastActivity?: string
  errorMessage?: string
}

export interface ScrapingResult {
  id: string
  queueItemId: string
  url: string
  username?: string
  totalVideos: number
  successfulVideos: number
  failedVideos: number
  csvFilePath?: string
  completedAt: string
  processingTime: number
  videoData?: VideoData[]
}

export interface VideoData {
  videoId: string
  url: string
  description?: string
  likes: number
  shares: number
  comments: number
  views: number
  duration?: string
  uploadDate?: string
  hashtags: string[]
  mentions: string[]
}

export interface SystemStats {
  totalQueued: number
  totalProcessing: number
  totalCompleted: number
  totalFailed: number
  activeWorkers: number
  totalWorkers: number
  uptime: number
}

// Real-time update types
export interface RealtimeUpdate {
  type: 'queue' | 'worker' | 'result' | 'stats'
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
} 