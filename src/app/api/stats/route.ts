import { NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'

export async function GET() {
  try {
    const stats = await databaseStore.getStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
} 