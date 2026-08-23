'use client'

import { type ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/contexts/ToastContext'
import { setFirestoreDb } from '@comp-dash/api'
import { getFirebaseDb } from '@/lib/firebase/client'
import { FirebaseAuthSync } from '@/components/common/FirebaseAuthSync'
import '@comp-dash/i18n'

// Registered at module scope, not in an effect. Effects run after children have
// mounted and after React Query has already fired its first fetch, so hooks
// that branch on isFirestoreEnabled() took the apiClient fallback on first load
// and hit /api/leaderboard/overall — a route the catch-all does not define,
// producing a 404 on every fresh page load.
const firestoreDb = getFirebaseDb()
if (firestoreDb) {
  setFirestoreDb(firestoreDb)
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseAuthSync />
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
