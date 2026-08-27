'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export default function TermsConditionsPage() {
  useEffect(() => {
    document.title = 'Terms & Conditions - Comp-Dash'
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-obsidian-canvas">
      <header className="border-b border-gray-200 dark:border-obsidian-border bg-white/80 dark:bg-obsidian-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                <span className="text-lg font-bold text-accent">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-ink-primary">Comp-Dash</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <header className="mb-12 text-center">
            <h1 className="font-display tracking-tight text-4xl sm:text-5xl font-medium text-gray-900 dark:text-ink-primary mb-4">Terms & Conditions</h1>
            <p className="text-lg text-gray-600 dark:text-ink-muted">Last updated: August 9, 2026</p>
          </header>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              By accessing and using Comp-Dash ("the Platform"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these Terms & Conditions, please do not use this Platform.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">2. Use of the Platform</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              Comp-Dash is a competition management dashboard designed for educational institutions. You agree to use the Platform only for lawful purposes and in accordance with these Terms.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li>You must not use the Platform for any illegal or unauthorized purpose.</li>
              <li>You must not interfere with or disrupt the integrity or performance of the Platform.</li>
              <li>You must not attempt to gain unauthorized access to any part of the Platform.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">3. User Accounts</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              Certain features of the Platform require user registration. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your password and account.</li>
              <li>Accept responsibility for all activities under your account.</li>
              <li>Notify us immediately of any unauthorized use of your account.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">4. Intellectual Property</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              The Platform and its original content, features, and functionality are owned by Comp-Dash and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">5. Data Privacy</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              Your use of the Platform is also governed by our <Link href="/security-policy" className="text-accent dark:text-uv hover:underline">Security Policy</Link>. Please review our Security Policy to understand our practices.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">6. Competition Data</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              Competition information displayed on the Platform is sourced from organizers and public sources. While we strive for accuracy, we do not guarantee the completeness or reliability of all competition data.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">7. Limitation of Liability</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              In no event shall Comp-Dash, its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Platform.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">8. Modifications</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the Platform after any modifications constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">9. Governing Law</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="font-display tracking-tight text-2xl font-medium text-gray-900 dark:text-ink-primary mb-4">10. Contact Us</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              If you have any questions about these Terms & Conditions, please contact us at:
            </p>
            <address className="not-italic text-gray-700 dark:text-ink-muted">
              <p>Comp-Dash Support Team</p>
              <p>Email: support@comp-dash.com</p>
              <p>Address: Chennai Institute of Technology, Chennai, Tamil Nadu, India</p>
            </address>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-obsidian-border text-center">
          <Link href="/" className="text-accent dark:text-uv hover:underline">
            ← Back to Home
          </Link>
        </footer>
      </main>

      <footer className="border-t border-gray-200 dark:border-obsidian-border bg-white/50 dark:bg-obsidian-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500 dark:text-obsidian-faint">
          <p>&copy; 2026 Comp-Dash. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link href="/terms-conditions" className="hover:underline">Terms & Conditions</Link>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <Link href="/security-policy" className="hover:underline">Security Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}