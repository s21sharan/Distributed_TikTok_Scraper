import { NextResponse } from 'next/server'
import { databaseStore } from '@/lib/storage-db'

export async function GET() {
  try {
    const results = await databaseStore.getResults()
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
} 