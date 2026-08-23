'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, KeyRound, Loader2, LogIn } from 'lucide-react'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState('')
  const [isUnauthorizedRole, setIsUnauthorizedRole] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsUnauthorizedRole(false)
    setSuccessMessage('')

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and Confirm password do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          newPassword,
          confirmPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update password. Please check your email.')
        if (data.redirectSignIn || res.status === 403) {
          setIsUnauthorizedRole(true)
        }
        setLoading(false)
        return
      }

      setSuccessMessage(data.message || 'Password successfully updated!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-canvas relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-ink-primary mb-2">Reset Password</h1>
          <p className="text-sm text-gray-500 dark:text-obsidian-faint">
            Enter your email and new password to update your account
          </p>
        </div>

        {successMessage ? (
          <div className="bg-white dark:bg-obsidian-surface rounded-2xl shadow-sm border border-gray-100 dark:border-obsidian-border p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-ink-primary">Password Updated!</h2>
              <p className="text-sm text-gray-600 dark:text-obsidian-faint">
                {successMessage}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/sign-in"
                className="w-full inline-flex items-center justify-center h-11 bg-accent dark:bg-striver text-white rounded-xl font-medium text-sm hover:bg-accent/90 dark:hover:bg-striver-hover transition-colors"
              >
                Sign In with New Password
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-obsidian-surface rounded-2xl shadow-sm border border-gray-100 dark:border-obsidian-border p-8 space-y-5"
          >
            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {isUnauthorizedRole && (
                  <div className="pt-1">
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-xs transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Redirect to Sign In
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 chars)"
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-300 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint hover:text-gray-600 dark:hover:text-ink-muted"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 dark:text-ink-muted mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-300 dark:border-obsidian-border bg-white dark:bg-obsidian-hover text-gray-900 dark:text-ink-primary placeholder-gray-400 dark:placeholder-obsidian-faint font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-obsidian-faint hover:text-gray-600 dark:hover:text-ink-muted"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent dark:bg-striver text-white rounded-xl font-medium text-sm hover:bg-accent/90 dark:hover:bg-striver-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent dark:text-uv hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
