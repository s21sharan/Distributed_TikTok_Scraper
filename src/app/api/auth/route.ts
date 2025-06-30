import { NextRequest, NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'

export async function GET() {
  return NextResponse.json({ message: 'Auth endpoint' })
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()
    
    const API_SECRET_KEY = process.env.API_SECRET_KEY
    
    if (!API_SECRET_KEY) {
      return NextResponse.json({ 
        valid: true, 
        message: 'No API key required in development mode' 
      })
    }

    const isValid = apiKey === API_SECRET_KEY
    
    return NextResponse.json({ 
      valid: isValid,
      message: isValid ? 'Valid API key' : 'Invalid API key'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
} 