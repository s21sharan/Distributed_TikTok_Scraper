import { NextRequest, NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { authenticate } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit')
    
    const queue = await databaseStore.getQueue(limit ? parseInt(limit) : undefined)
    return NextResponse.json(queue)
  } catch (error) {
    console.error('Error fetching queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, type = 'profile' } = body
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }
    
    // Basic TikTok URL validation
    const tiktokRegex = /^https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)/
    if (!tiktokRegex.test(url)) {
      return NextResponse.json(
        { error: 'Invalid TikTok URL' },
        { status: 400 }
      )
    }
    
    const queueItem = await databaseStore.addToQueue(url, type)
    return NextResponse.json(queueItem, { status: 201 })
  } catch (error) {
    console.error('Error adding to queue:', error)
    return NextResponse.json(
      { error: 'Failed to add to queue' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { id, action, workerId, error } = body
    
    if (!id || !action) {
      return NextResponse.json(
        { error: 'ID and action are required' },
        { status: 400 }
      )
    }
    
    let updates = {}
    
    switch (action) {
      case 'start':
        updates = {
          status: 'processing',
          startedAt: new Date().toISOString(),
          workerId: workerId
        }
        break
      case 'complete':
        updates = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          progress: 100
        }
        break
      case 'fail':
        updates = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error || 'Task failed'
        }
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
    
    const updatedItem = await databaseStore.updateQueueItem(id, updates)
    if (!updatedItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error updating queue item:', error)
    return NextResponse.json(
      { error: 'Failed to update queue item' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }
    
    const success = await databaseStore.removeFromQueue(id)
    if (!success) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from queue:', error)
    return NextResponse.json(
      { error: 'Failed to remove from queue' },
      { status: 500 }
    )
  }
} 