import { NextRequest, NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'
import { authenticate } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const cleanedCount = await databaseStore.cleanupOrphanedLocks()
    return NextResponse.json({ 
      success: true, 
      cleanedLocks: cleanedCount,
      message: `Cleaned ${cleanedCount} orphaned locks`
    })
  } catch (error) {
    console.error('Error cleaning up orphaned locks:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup orphaned locks' },
      { status: 500 }
    )
  }
} 