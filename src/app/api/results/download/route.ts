import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { authenticate } from '@/lib/auth'

interface DownloadRequest {
  username?: string
  videoId?: string
}

export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body: DownloadRequest = await request.json()
    const { username, videoId } = body

    if (!username && !videoId) {
      return NextResponse.json(
        { error: 'Either username or videoId is required' },
        { status: 400 }
      )
    }

    let videoData: any[] = []

    if (videoId && username) {
      // Download specific video
      const video = await prisma.videoData.findFirst({
        where: {
          videoId: videoId,
          result: {
            username: username
          }
        },
        include: {
          result: {
            select: {
              username: true,
              completedAt: true
            }
          }
        }
      })

      if (video) {
        videoData = [video]
      }
    } else if (username) {
      // Download all videos for artist
      videoData = await prisma.videoData.findMany({
        where: {
          result: {
            username: username
          }
        },
        include: {
          result: {
            select: {
              username: true,
              completedAt: true
            }
          }
        },
        orderBy: {
          views: 'desc'
        }
      })
    }

    if (videoData.length === 0) {
      return NextResponse.json(
        { error: 'No videos found for the specified criteria' },
        { status: 404 }
      )
    }

    // Convert to CSV
    const csvHeaders = [
      'Video ID',
      'URL',
      'Username',
      'Description',
      'Views',
      'Likes',
      'Comments',
      'Shares',
      'Duration',
      'Upload Date',
      'Scraped At',
      'Hashtags',
      'Mentions',
      'Comments Count',
      'Sample Comments'
    ]

    const csvRows = videoData.map(video => [
      video.videoId,
      video.url,
      video.result.username || '',
      `"${(video.description || '').replace(/"/g, '""')}"`, // Escape quotes
      video.views,
      video.likes,
      video.comments,
      video.shares,
      video.duration || '',
      video.uploadDate ? new Date(video.uploadDate).toISOString() : '',
      new Date(video.result.completedAt).toISOString(),
      `"${video.hashtags.join(', ')}"`,
      `"${video.mentions.join(', ')}"`,
      video.commentTexts.length,
      `"${video.commentTexts.slice(0, 3).join(' | ').replace(/"/g, '""')}"` // Sample comments
    ])

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n')

    const filename = videoId 
      ? `${username}_${videoId}_video_data.csv`
      : `${username}_all_videos.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error downloading video data:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to download video data', details: errorMessage },
      { status: 500 }
    )
  }
} 