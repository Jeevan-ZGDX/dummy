'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client'
import { establishSession, abandonSession } from '@/lib/firebase/establish-session'
import { isAuthenticated } from '@/lib/auth'
import { GoogleSignInButton } from '@/components/common/GoogleSignInButton'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      const next = searchParams.get('next') || '/dashboard'
      router.replace(next)
    }
  }, [router, searchParams])

  const configured = isFirebaseConfigured()

  const oauthError = searchParams.get('error')
  const oauthMessage = searchParams.get('message')
  const pendingGoogle = oauthError !== null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    const auth = getFirebaseAuth()
    if (!auth) {
      setError('Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables, then restart the app.')
      setLoading(false)
      return
    }

    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password)

      // Firebase authenticated the account; the server still has to approve it
      // (college domain + role_access) before any session cookie is issued.
      const result = await establishSession(credential.user)
      if (!result.ok) {
        await abandonSession()
        setError(result.error || 'Sign in was rejected.')
        setLoading(false)
        return
      }
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/user-not-found'
          ? 'Invalid email or password'
          : (err as Error).message || 'Could not sign in'
      )
      setLoading(false)
      return
    }

    setLoading(false)
    const next = searchParams.get('next') || '/dashboard'
    router.push(next)
    router.refresh()
  }

  const emailDomain = email.trim().split('@')[1]
  const isCollegeEmail = emailDomain && emailDomain.endsWith('citchennai.net')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-canvas relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-accent">C</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-ink-primary mb-2">Welcome Back</h1>
          <p className="text-gray-500 dark:text-obsidian-faint">Sign in to your Comp-Dash account</p>
        </div>

        {pendingGoogle && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {oauthMessage || 'Google sign in could not be completed. Please try again.'}
          </div>
        )}

        <GoogleSignInButton />

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-gray-200 dark:bg-obsidian-border" />
          <span className="text-xs font-medium text-gray-400 dark:text-obsidian-faint">
            or sign in with email
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-obsidian-border" />
        </div>

        {isCollegeEmail || email.trim() === '' ? (
          !isCollegeEmail && email.trim() !== '' && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
              <p>Google OAuth is only available for @citchennai.net email addresses.</p>
              <p className="mt-1">Sign up or use your college email to connect Gmail.</p>
            </div>
          )
        ) : null}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-obsidian-surface rounded-2xl shadow-sm border border-gray-100 dark:border-obsidian-border p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {!configured && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Firebase Auth is not configured. Add NEXT_PUBLIC_FIREBASE_API_KEY and
              NEXT_PUBLIC_FIREBASE_PROJECT_ID to your environment to enable sign in.
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@citchennai.net"
              className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-ink-muted">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-accent dark:text-uv font-medium hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-300 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint hover:text-gray-600 dark:hover:text-ink-muted"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 dark:text-obsidian-faint font-medium">
              Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="text-left text-xs p-1 rounded hover:bg-accent/10" onClick={()=>{setEmail('admin@citchennai.net');setPassword('CompDash@123')}}>Admin: admin@citchennai.net / CompDash@123</button>
              <button type="button" className="text-left text-xs p-1 rounded hover:bg-accent/10" onClick={()=>{setEmail('hod@citchennai.net');setPassword('CompDash@123')}}>HOD: hod@citchennai.net / CompDash@123</button>
              <button type="button" className="text-left text-xs p-1 rounded hover:bg-accent/10" onClick={()=>{setEmail('advisor@citchennai.net');setPassword('CompDash@123')}}>Advisor: advisor@citchennai.net / CompDash@123</button>
              <button type="button" className="text-left text-xs p-1 rounded hover:bg-accent/10" onClick={()=>{setEmail('student@citchennai.net');setPassword('CompDash@123')}}>Student: student@citchennai.net / CompDash@123</button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !configured}
            className="w-full h-11 bg-accent dark:bg-striver text-white rounded-xl font-medium text-sm hover:bg-accent/90 dark:hover:bg-striver-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-obsidian-faint">
            Having trouble signing in?{' '}
            <Link href="/forgot-password" className="text-accent dark:text-uv font-medium hover:underline">
              Forgot Password
            </Link>
          </p>
        </form>

        <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-2">
          <p className="font-medium text-sm">Demo Accounts</p>
            <p>
            Run <code className="font-mono bg-blue-100/70 px-1 rounded">npm run seed:auth</code> to
            create the demo users (admin, hod, advisor, student). Otherwise sign up with your
            college email.
          </p>
            <div className="mt-4 p-2 bg-white dark:bg-obsidian-surface rounded-xl text-xs text-gray-600 dark:text-obsidian-faint border border-gray-200 dark:border-obsidian-border">
              <p className="text-center">By signing in you agree to our <a href="/terms" className="text-accent hover:underline">Terms of Use</a> and <a href="/policy" className="text-accent hover:underline">Privacy Policy</a>.</p>
            </div>
        </div>
      </div>
    </div>
  )
}