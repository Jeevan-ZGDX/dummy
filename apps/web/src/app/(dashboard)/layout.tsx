'use client'

import { useState } from 'react'
import { Providers } from '@/components/Providers'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardHeader } from '@/components/layout/DashboardHeader'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <Providers>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-obsidian-canvas dark:text-ink-primary transition-colors duration-200">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className={`${sidebarOpen ? 'ml-64' : 'ml-0'} transition-all duration-300`}>
          <DashboardHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  )
}
