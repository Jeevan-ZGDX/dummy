import { NextResponse } from 'next/server'

/**
 * The `{ success, data }` envelope every hook expects.
 *
 * `apiClient.get()` returns `response.data.data`, so a route that returns its
 * payload at the top level resolves to `undefined` in the client. The catch-all
 * route already wraps its responses this way; standalone route handlers must
 * match it or their hooks silently receive nothing.
 */
export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init)
}

export function apiError(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error: { code, message, ...extra } },
    { status }
  )
}
