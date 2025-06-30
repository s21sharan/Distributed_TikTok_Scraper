import { NextRequest } from 'next/server'

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