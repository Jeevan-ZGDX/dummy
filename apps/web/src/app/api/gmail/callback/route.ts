import { NextRequest, NextResponse } from 'next/server'
import { storeGmailTokens } from '@/lib/gmail-tokens'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = new URL('/email-verification', request.url)

  if (error) {
    baseUrl.searchParams.set('error', error)
    return NextResponse.redirect(baseUrl)
  }

  if (!code || !state) {
    baseUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(baseUrl)
  }

  let competitionId: string
  let userEmail: string

  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
    competitionId = decoded.competitionId
    userEmail = decoded.userEmail
  } catch {
    baseUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(baseUrl)
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || 'Failed to exchange code for tokens')
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoResponse.json()

    if (userInfo.email !== userEmail) {
      throw new Error('Email mismatch')
    }

    await storeGmailTokens({
      user_id: userEmail,
      user_email: userEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    })

    const verifyUrl = new URL('/api/gmail/verify', request.url)
    verifyUrl.searchParams.set('competitionId', competitionId)
    verifyUrl.searchParams.set('userEmail', userEmail)
    const verifyResponse = await fetch(verifyUrl.toString(), { method: 'POST' })
    const verifyData = await verifyResponse.json()

    const redirectUrl = new URL('/competitions', request.url)
    redirectUrl.searchParams.set('verified', 'true')
    redirectUrl.searchParams.set('status', verifyData.verified ? 'success' : 'not_found')
    return NextResponse.redirect(redirectUrl)

  } catch (err) {
    console.error('Gmail OAuth callback error:', err)
    baseUrl.searchParams.set('error', 'verification_failed')
    return NextResponse.redirect(baseUrl)
  }
}