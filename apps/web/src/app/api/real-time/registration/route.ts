import { NextRequest, NextResponse } from 'next/server'

const SECRET_KEY = process.env.REAL_TIME_API_SECRET

export async function POST(request: NextRequest) {
  if (!SECRET_KEY) {
    return NextResponse.json(
      { success: false, error: 'Server not configured' },
      { status: 503 }
    )
  }

  const body = await request.json()
  const { secret, event, data } = body

  if (secret !== SECRET_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!event || !data) {
    return NextResponse.json({ success: false, error: 'Missing event or data' }, { status: 400 })
  }

  const timestamp = new Date().toISOString()

  const payload = {
    id: `evt-${timestamp}-${Math.random().toString(36).substring(2, 9)}`,
    event,
    data,
    timestamp,
  }

  return NextResponse.json({ success: true, event: payload })
}