import type { Metadata } from 'next'
import { Inter, Newsreader } from 'next/font/google'
import { ThemeProvider } from '@/contexts/ThemeContext'
import './globals.css'

/**
 * Two faces, two jobs.
 *
 * Inter carries the interface: dense tables, labels and numbers, where a serif
 * would cost legibility. Newsreader carries page titles and display numbers —
 * it is the closest freely available stand-in for the Tiempos-style serif that
 * gives Anthropic's work its voice, and it keeps headings from reading like
 * just-bigger body text.
 */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const display = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Comp-Dash',
  description: 'Competition Management Dashboard',
}

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('theme');
      var theme = saved === 'dark' || saved === 'light' ? saved : 'system';
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900 min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
