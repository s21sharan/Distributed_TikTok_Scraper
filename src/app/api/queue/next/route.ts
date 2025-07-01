import { NextRequest, NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { authenticate } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const nextItem = await databaseStore.getNextPendingItem()
    return NextResponse.json(nextItem || { error: 'No pending tasks' })
  } catch (error) {
    console.error('Error fetching next pending task:', error)
    return NextResponse.json(
      { error: 'Failed to fetch next pending task' },
      { status: 500 }
    )
  }
} 