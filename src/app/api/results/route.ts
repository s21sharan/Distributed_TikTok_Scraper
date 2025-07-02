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

    console.log(`💾 Saving ${videoData.length} video results for queue item ${queueItemId}`)
    
    // Debug: Log first video data to see what fields are being received
    if (videoData.length > 0) {
      console.log('🔍 DEBUG: First video data received:', {
        keys: Object.keys(videoData[0]),
        description: videoData[0].description,
        duration: videoData[0].duration,
        upload_date: videoData[0].upload_date,
        hashtags: videoData[0].hashtags,
        mentions: videoData[0].mentions,
        comments_list: videoData[0].comments_list?.length ? `${videoData[0].comments_list.length} comments` : 'no comments'
      })
    }
    
    const result = await databaseStore.saveResults(queueItemId, videoData)
    
    console.log('✅ Results saved successfully:', {
      resultId: result.id,
      totalVideos: result.totalVideos,
      username: result.username
    })
    
    // Debug: Log first video result to see what was actually saved
    if (result.videoData && result.videoData.length > 0) {
      console.log('🔍 DEBUG: First video result saved:', {
        description: result.videoData[0].description,
        duration: result.videoData[0].duration,
        uploadDate: result.videoData[0].uploadDate,
        hashtags: result.videoData[0].hashtags,
        mentions: result.videoData[0].mentions,
        commentTexts: result.videoData[0].commentTexts?.length ? `${result.videoData[0].commentTexts.length} comments` : 'no comments'
      })
    }
    
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