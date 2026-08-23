export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pingFirestore } from '@/lib/firestore-data'
import { isFirestoreConfigured } from '@/lib/firestore-data'

export async function GET() {
  let dbStatus = 'not_configured'

  if (isFirestoreConfigured()) {
    const { ok } = await pingFirestore()
    dbStatus = ok ? 'connected' : 'error'
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
  })
}