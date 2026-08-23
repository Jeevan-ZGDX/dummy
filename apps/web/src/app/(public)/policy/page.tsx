'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export default function SecurityPolicyPage() {
  useEffect(() => {
    document.title = 'Security Policy - Comp-Dash'
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
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-ink-primary mb-4">Security Policy</h1>
            <p className="text-lg text-gray-600 dark:text-ink-muted">Last updated: August 9, 2026</p>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">1. Introduction</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              Comp-Dash takes the security of your data seriously. This Security Policy outlines the measures we implement to protect your information and the security practices we follow to maintain a secure platform.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">2. Data Encryption</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>In Transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.</li>
              <li><strong>At Rest:</strong> Sensitive data stored in our databases is encrypted using AES-256 encryption.</li>
              <li><strong>Database Connections:</strong> All database connections use encrypted channels with certificate validation.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">3. Authentication & Access Control</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Multi-Factor Authentication (MFA):</strong> Available for all administrative accounts.</li>
              <li><strong>Role-Based Access Control (RBAC):</strong> Users are granted minimum necessary permissions based on their role (Student, Advisor, HOD, Super Admin).</li>
              <li><strong>Session Management:</strong> Secure JWT tokens with automatic expiration and refresh mechanisms.</li>
              <li><strong>Password Policy:</strong> Enforced strong password requirements with bcrypt hashing.</li>
              <li><strong>Account Lockout:</strong> Automatic lockout after failed login attempts to prevent brute-force attacks.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">4. Data Protection & Privacy</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Data Minimization:</strong> We collect only the data necessary for platform functionality.</li>
              <li><strong>Student Data:</strong> Student information is used solely for competition management and verification purposes.</li>
              <li><strong>Data Retention:</strong> Personal data is retained only as long as necessary for the stated purposes.</li>
              <li><strong>Third-Party Sharing:</strong> We do not sell or share personal data with third parties except as required by law.</li>
              <li><strong>Right to Deletion:</strong> Users may request deletion of their personal data subject to legal obligations.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">5. Infrastructure Security</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Cloud Hosting:</strong> Hosted on secure, compliant cloud infrastructure (Vercel/Supabase).</li>
              <li><strong>Network Security:</strong> Firewalls, DDoS protection, and intrusion detection systems.</li>
              <li><strong>Regular Updates:</strong> Automated security patches and dependency updates.</li>
              <li><strong>Monitoring:</strong> 24/7 security monitoring with automated alerting for suspicious activities.</li>
              <li><strong>Backup & Recovery:</strong> Automated daily backups with point-in-time recovery.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">6. Application Security</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Secure Development:</strong> Following OWASP Top 10 guidelines and secure coding practices.</li>
              <li><strong>Input Validation:</strong> Strict validation and sanitization of all user inputs.</li>
              <li><strong>Content Security Policy:</strong> Implemented CSP headers to prevent XSS attacks.</li>
              <li><strong>Dependency Scanning:</strong> Automated scanning for vulnerable dependencies in CI/CD pipeline.</li>
              <li><strong>Code Reviews:</strong> Mandatory security-focused code reviews for all changes.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">7. Incident Response</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Response Plan:</strong> Documented incident response procedures with defined escalation paths.</li>
              <li><strong>Notification:</strong> Affected users notified within 72 hours of confirmed data breaches as required by applicable law.</li>
              <li><strong>Forensics:</strong> Logs retained for forensic analysis and compliance purposes.</li>
              <li><strong>Post-Incident Review:</strong> Root cause analysis and preventive measures after each incident.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">8. Compliance & Standards</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li><strong>Data Protection:</strong> Aligned with India's DPDP Act 2023 and GDPR principles.</li>
              <li><strong>Educational Records:</strong> Compliant with relevant educational data protection regulations.</li>
              <li><strong>Audit Logs:</strong> Comprehensive audit trails for all administrative actions.</li>
              <li><strong>Security Testing:</strong> Annual penetration testing and vulnerability assessments.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">9. Vendor Security</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              We evaluate the security practices of all third-party vendors and service providers before integration:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li>Supabase (Database & Auth) - SOC 2 Type II certified</li>
              <li>Vercel (Hosting) - SOC 2 Type II certified</li>
              <li>Google OAuth - Industry-standard OAuth 2.0 implementation</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">10. Reporting Security Issues</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              We encourage responsible disclosure of security vulnerabilities. If you discover a security issue, please report it to:
            </p>
            <address className="not-italic text-gray-700 dark:text-ink-muted">
              <p><strong>Security Team:</strong> security@comp-dash.com</p>
              <p><strong>Response Time:</strong> We acknowledge reports within 48 hours</p>
              <p><strong>Bug Bounty:</strong> We offer recognition for valid security findings</p>
            </address>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">11. User Responsibilities</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              You play a crucial role in maintaining security:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-ink-muted">
              <li>Use strong, unique passwords and enable MFA when available.</li>
              <li>Do not share your credentials with anyone.</li>
              <li>Log out from shared or public devices.</li>
              <li>Report suspicious activities immediately.</li>
              <li>Keep your contact information up to date for security notifications.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">12. Policy Updates</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              This Security Policy may be updated periodically to reflect changes in our practices or regulatory requirements. Significant changes will be communicated via email or platform notification.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-ink-primary mb-4">13. Contact Us</h2>
            <p className="text-gray-700 dark:text-ink-muted mb-4">
              For questions about this Security Policy or our security practices:
            </p>
            <address className="not-italic text-gray-700 dark:text-ink-muted">
              <p>Comp-Dash Security Team</p>
              <p>Email: security@comp-dash.com</p>
              <p>General Support: support@comp-dash.com</p>
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