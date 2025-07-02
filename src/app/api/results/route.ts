import { NextRequest, NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { authenticate } from '@/lib/auth'

export async function GET() {
  try {
    const results = await databaseStore.getResults()
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching results:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to fetch results', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    console.log('📥 Received results data:', { 
      hasQueueItemId: !!body.queueItemId,
      bodyKeys: Object.keys(body),
      isArray: Array.isArray(body)
    })

    // Extract queueItemId and video data from the request
    let queueItemId: string
    let videoData: any[]

    if (body.queueItemId) {
      // Standard format: { queueItemId: "...", videoData: [...] }
      queueItemId = body.queueItemId
      
      // Check if videoData is provided directly
      if (body.videoData && Array.isArray(body.videoData)) {
        videoData = body.videoData
      } else {
        // Fallback: try to extract from the rest of the body
        const { queueItemId: _, videoData: __, ...rest } = body
        
        // Check if the rest is a direct array or if it's spread into the object
        if (Array.isArray(rest)) {
          videoData = rest
        } else if (Object.keys(rest).length > 0) {
          // If there are numbered keys (0, 1, 2, etc.), reconstruct the array
          const keys = Object.keys(rest).filter(key => /^\d+$/.test(key)).sort((a, b) => parseInt(a) - parseInt(b))
          if (keys.length > 0) {
            videoData = keys.map(key => rest[key])
          } else {
            // Treat the entire rest object as a single video entry
            videoData = [rest]
          }
        } else {
          videoData = []
        }
      }
    } else if (Array.isArray(body)) {
      // If the entire body is an array, we need queueItemId from somewhere else
      return NextResponse.json(
        { error: 'Queue item ID is required when sending array data' },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { error: 'Invalid request format. Expected { queueItemId: string, ...videoData }' },
        { status: 400 }
      )
    }

    if (!queueItemId) {
      return NextResponse.json(
        { error: 'Queue item ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Processing raw scraper output with ${videoData.length} items for queue item ${queueItemId}`)
    
    // Debug: Log first video data to see what fields are being received
    if (videoData.length > 0) {
      console.log('🔍 DEBUG: First raw video data received:', {
        keys: Object.keys(videoData[0]),
        video_url: videoData[0].video_url,
        views: videoData[0].views,
        views_raw: videoData[0].views_raw,
        description: videoData[0].description?.substring(0, 50) + '...',
        hashtags: videoData[0].hashtags?.length || 0,
        mentions: videoData[0].mentions?.length || 0,
        comments_list: videoData[0].comments_list?.length || 0
      })
    }
    
    // Use the new scraper parser to process and save the data
    const { processTikTokScraperOutput } = await import('@/lib/scraper-parser')
    const result = await processTikTokScraperOutput(queueItemId, videoData)
    
    console.log('✅ Results processed and saved successfully:', {
      resultId: result.id,
      totalVideos: result.totalVideos,
      username: result.username
    })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error saving results:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to save results', details: errorMessage },
      { status: 500 }
    )
  }
} 