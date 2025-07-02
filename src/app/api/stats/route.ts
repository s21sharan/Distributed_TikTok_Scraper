import { NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { prisma } from '@/lib/database'

export async function GET() {
  try {
    // Get basic stats from databaseStore
    const basicStats = await databaseStore.getStats()
    
    // Get additional stats that we need for the dashboard
    const [
      totalResults,
      recentResults,
      totalVideos,
      queueItems
    ] = await Promise.all([
      // Total scraping results
      prisma.scrapingResult.count(),
      
      // Results completed in the last 24 hours
      prisma.scrapingResult.count({
        where: {
          completedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total videos scraped
      prisma.videoData.count(),
      
      // All queue items for total count
      prisma.queueItem.count()
    ])

    // Map the data to what the dashboard expects
    const dashboardStats = {
      totalInQueue: queueItems,
      activeWorkers: basicStats.activeWorkers,
      totalResults: totalVideos, // Total videos scraped
      recentlyCompleted: recentResults, // Completed in last 24h
      pendingTasks: basicStats.totalQueued, // Pending queue items
      failedTasks: basicStats.totalFailed,
      
      // Additional useful stats
      totalWorkers: basicStats.totalWorkers,
      totalProcessing: basicStats.totalProcessing,
      totalCompleted: basicStats.totalCompleted,
      uptime: basicStats.uptime,
      scrapingResults: totalResults, // Total scraping operations
      
      // Performance metrics
      successRate: basicStats.totalCompleted + basicStats.totalFailed > 0 
        ? Math.round((basicStats.totalCompleted / (basicStats.totalCompleted + basicStats.totalFailed)) * 100)
        : 0,
      avgVideosPerResult: totalResults > 0 ? Math.round(totalVideos / totalResults) : 0
    }

    return NextResponse.json(dashboardStats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: errorMessage },
      { status: 500 }
    )
  }
} 