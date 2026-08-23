import { useState, useEffect, useCallback } from 'react'

interface OfflineState {
  isOnline: boolean
  isReconnecting: boolean
  lastOnline: Date | null
}

export function useOffline(): OfflineState {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isReconnecting: false,
    lastOnline: null,
  })

  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
        isReconnecting: false,
        lastOnline: new Date(),
      }))
    }

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
        isReconnecting: false,
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return state
}

export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Silently fail if localStorage is full
    }
  }, [key, state])

  return [state, setState]
}
