import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { User, AuthState } from '@comp-dash/types'
import { apiClient } from '@comp-dash/api'

interface AuthContextType extends AuthState {
  login: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthProvider(): AuthContextType {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const refreshUser = useCallback(async () => {
    try {
      const token = apiClient.getToken()
      if (!token) {
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
        return
      }
      const user = await apiClient.get<User>('/auth/me')
      setState({ user, token, isAuthenticated: true, isLoading: false })
    } catch {
      apiClient.setToken(null)
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (idToken: string) => {
    const response = await apiClient.post<{ user: User; token: string }, { idToken: string }>('/auth/google', { idToken })
    apiClient.setToken(response.token)
    setState({ user: response.user, token: response.token, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      apiClient.setToken(null)
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false })
    }
  }, [])

  return { ...state, login, logout, refreshUser }
}

export { AuthContext }
