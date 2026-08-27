'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client'
import { establishSession, abandonSession } from '@/lib/firebase/establish-session'
import { isAllowedEmail } from '@/lib/auth'
import { GoogleSignInButton } from '@/components/common/GoogleSignInButton'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const configured = isFirebaseConfigured()

  const oauthError = searchParams.get('error')
  const oauthMessage = searchParams.get('message')
  const pendingGoogle = oauthError !== null

  const emailDomain = email.trim().split('@')[1]
  const isCollegeEmail = emailDomain && emailDomain.endsWith('citchennai.net')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email || !password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    if (isCollegeEmail) {
      const auth = getFirebaseAuth()
      if (!auth) {
        setError('Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables, then restart the app.')
        setLoading(false)
        return
      }

      try {
        const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } =
          await import('firebase/auth')
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        )

        await updateProfile(credential.user, {
          displayName: name.trim() || email.split('@')[0],
        })

        // Role and department are deliberately not set here — they are resolved
        // server-side from role_access and written as custom claims, so a client
        // cannot mint itself a privileged account at sign-up.
        await sendEmailVerification(credential.user).catch(() => {})

        const result = await establishSession(credential.user)
        if (!result.ok) {
          await abandonSession()
          setError(result.error || 'Account created, but sign in was rejected.')
          setLoading(false)
          return
        }
      } catch (err) {
        const code = (err as { code?: string }).code
        setError(
          code === 'auth/email-already-in-use'
            ? 'An account with that email already exists.'
            : code === 'auth/weak-password'
              ? 'Password should be at least 6 characters.'
              : (err as Error).message || 'Failed to create account'
        )
        setLoading(false)
        return
      }

      setLoading(false)
      setCheckEmail(true)
      return
    }

    if (!isCollegeEmail) {
      setError('Only @citchennai.net emails are accepted for Google OAuth. Please use your college email or sign up with a valid @citchennai.net address.')
      setLoading(false)
      return
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-obsidian-canvas relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-obsidian-surface rounded-2xl shadow-sm border border-gray-100 dark:border-obsidian-border p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="font-display tracking-tight text-xl font-medium text-gray-900 dark:text-ink-primary">Check your email</h1>
            <p className="text-sm text-gray-500 dark:text-obsidian-faint">
              We sent a confirmation link to <span className="font-medium text-gray-700 dark:text-ink-muted">{email}</span>.
              Confirm your email, then sign in to get started.
            </p>
            <Link
              href="/sign-in"
              className="inline-block px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
          <h1 className="font-display tracking-tight text-3xl font-medium text-gray-900 dark:text-ink-primary mb-2">Create Account</h1>
          <p className="text-gray-500 dark:text-obsidian-faint">Join Comp-Dash to get started</p>
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
            or sign up with email
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-obsidian-border" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-obsidian-surface rounded-2xl shadow-sm border border-gray-100 dark:border-obsidian-border p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {!configured && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Firebase Auth is not configured. Add NEXT_PUBLIC_FIREBASE_API_KEY and
              NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment to enable sign up.
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

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
              className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            {email && !isAllowedEmail(email) && (
              <p className="text-xs text-amber-600 mt-1.5">
                Use your college email (@citchennai.net) — non-college accounts default to the student role.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (min. 6 characters)"
                className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
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

          <button
            type="submit"
            disabled={loading || !configured}
            className="w-full h-11 bg-accent dark:bg-striver text-white rounded-xl font-medium text-sm hover:bg-accent/90 dark:hover:bg-striver-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-obsidian-faint">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-accent dark:text-uv font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
