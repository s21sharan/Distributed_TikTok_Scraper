import { NextRequest, NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { authenticate } from '@/lib/auth'
import { redis } from '@/lib/redis'

export async function GET() {
  try {
    const workers = await databaseStore.getWorkers()
    return NextResponse.json(workers)
  } catch (error) {
    console.error('Error fetching workers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workers' },
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
    const { name } = body
    
    if (!name) {
      return NextResponse.json(
        { error: 'Worker name is required' },
        { status: 400 }
      )
    }
    
    const worker = await databaseStore.addWorker(name)
    return NextResponse.json(worker, { status: 201 })
  } catch (error) {
    console.error('Error creating worker:', error)
    return NextResponse.json(
      { error: 'Failed to create worker' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Worker ID is required' },
        { status: 400 }
      )
    }
    
    const worker = await databaseStore.updateWorker(id, updates)
    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(worker)
  } catch (error) {
    console.error('Error updating worker:', error)
    return NextResponse.json(
      { error: 'Failed to update worker' },
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
    const { workerId, action } = body
    
    if (!workerId || !action) {
      return NextResponse.json(
        { error: 'Worker ID and action are required' },
        { status: 400 }
      )
    }

    if (!['start', 'pause', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be start, pause, or stop' },
        { status: 400 }
      )
    }
    
    // Get worker info
    const worker = await databaseStore.getWorker(workerId)
    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }

    // Send control command to worker via Redis
    try {
      await redis.publish(`worker:${worker.name}:control`, JSON.stringify({
        action: action,
        timestamp: Date.now()
      }))
      console.log(`Control signal (${action}) sent to worker: ${worker.name}`)
    } catch (redisError) {
      console.error('Failed to send control signal to worker:', redisError)
      return NextResponse.json(
        { error: 'Failed to send control signal to worker' },
        { status: 500 }
      )
    }

    // Update worker status in database
    const statusMap: Record<string, string> = {
      'start': 'RUNNING',
      'pause': 'PAUSED', 
      'stop': 'STOPPED'
    }
    
    const updatedWorker = await databaseStore.updateWorker(workerId, {
      status: statusMap[action] as any
    })
    
    return NextResponse.json({ 
      success: true, 
      worker: updatedWorker,
      message: `Worker ${action} command sent successfully`
    })
  } catch (error) {
    console.error('Error controlling worker:', error)
    return NextResponse.json(
      { error: 'Failed to control worker' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Worker ID is required' },
        { status: 400 }
      )
    }
    
    const success = await databaseStore.removeWorker(id)
    if (!success) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing worker:', error)
    return NextResponse.json(
      { error: 'Failed to remove worker' },
      { status: 500 }
    )
  }
} 