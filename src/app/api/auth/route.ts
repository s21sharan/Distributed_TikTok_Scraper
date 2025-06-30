import { NextRequest, NextResponse } from 'next/server'

const API_SECRET_KEY = process.env.API_SECRET_KEY

export function authenticate(request: NextRequest): boolean {
  if (!API_SECRET_KEY) {
    // Allow all requests if no API key is set (development mode)
    return true
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7)
  return token === API_SECRET_KEY
}

export async function GET() {
  return NextResponse.json({ message: 'Auth endpoint' })
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()
    
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