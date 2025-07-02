import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'

    // Get all scraping results with video data
    const results = await prisma.scrapingResult.findMany({
      include: {
        videoData: true,
        queueItem: true
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    if (format === 'csv') {
      // Export as CSV
      const csvHeaders = [
        'Scraping Result ID',
        'Username',
        'Total Videos',
        'Successful Videos',
        'Failed Videos',
        'Completed At',
        'Processing Time (s)',
        'Video ID',
        'Video URL',
        'Description',
        'Views',
        'Likes',
        'Comments',
        'Shares',
        'Duration',
        'Upload Date',
        'Hashtags',
        'Mentions',
        'Comment Count',
        'Sample Comments'
      ]

      const csvRows: string[][] = []

      results.forEach(result => {
        if (result.videoData.length === 0) {
          // Include the result even if no videos
          csvRows.push([
            result.id,
            result.username || '',
            result.totalVideos.toString(),
            result.successfulVideos.toString(),
            result.failedVideos.toString(),
            new Date(result.completedAt).toISOString(),
            result.processingTime.toString(),
            '', '', '', '', '', '', '', '', '', '', '', '', ''
          ])
        } else {
          result.videoData.forEach(video => {
            csvRows.push([
              result.id,
              result.username || '',
              result.totalVideos.toString(),
              result.successfulVideos.toString(),
              result.failedVideos.toString(),
              new Date(result.completedAt).toISOString(),
              result.processingTime.toString(),
              video.videoId,
              video.url,
              `"${(video.description || '').replace(/"/g, '""')}"`, // Escape quotes
              video.views.toString(),
              video.likes.toString(),
              video.comments.toString(),
              video.shares.toString(),
              video.duration || '',
              video.uploadDate ? new Date(video.uploadDate).toISOString() : '',
              `"${video.hashtags.join(', ')}"`,
              `"${video.mentions.join(', ')}"`,
              video.commentTexts.length.toString(),
              `"${video.commentTexts.slice(0, 3).join(' | ').replace(/"/g, '""')}"` // Sample comments
            ])
          })
        }
      })

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.join(','))
        .join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tiktok_results_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Default: return JSON
    const formattedResults = results.map(result => ({
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
      videoData: result.videoData.map(video => ({
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
      }))
    }))

    return NextResponse.json(formattedResults)

  } catch (error) {
    console.error('Error exporting results:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to export results', details: errorMessage },
      { status: 500 }
    )
  }
} 