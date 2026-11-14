import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { setupAuthInterceptor } from '@/lib/pocketbase/authInterceptor'
import type { UserRecord } from '@/types/database'

// Sessão só é descartada em 401 real do backend (token expirado/revogado);
// falha de rede ou 5xx NÃO deslogam — evita cair no /login numa instabilidade.
setupAuthInterceptor()

interface AuthContextType {
  user: UserRecord | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<void>
  signup: (email: string, pass: string, name: string) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>
  confirmVerification: (token: string) => Promise<void>
  requestEmailChange: (newEmail: string) => Promise<void>
  confirmEmailChange: (token: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(() => {
    return (pb.authStore.record as unknown as UserRecord) || null
  })
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Sync state with PocketBase authStore changes
    const unsub = pb.authStore.onChange((newToken, model) => {
      setToken(newToken || null)
      setUser((model as unknown as UserRecord) || null)
    })

    // Renova a sessão do PocketBase. Só considera a sessão morta quando o
    // backend responde 401 de verdade (token expirado/revogado). Falhas de
    // rede ou erro 5xx NÃO deslogam — evita o usuário cair no /login ao
    // trocar de rede ou em uma instabilidade momentânea do backend.
    const refreshSession = async () => {
      if (!pb.authStore.isValid) {
        setIsLoading(false)
        return
      }
      try {
        await pb.collection('users').authRefresh()
      } catch (err: unknown) {
        const status =
          (err as { status?: number })?.status ??
          (err as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          pb.authStore.clear()
        }
        // outros erros: mantém a sessão; o token atual ainda pode ser válido
      } finally {
        setIsLoading(false)
      }
    }

    // Checagem inicial (token persistido no localStorage)
    refreshSession()

    // O token de autenticação do PocketBase expira; renovar periodicamente
    // evita o 401 surpresa no meio do uso (que deslogaria de vez).
    const interval = setInterval(refreshSession, 10 * 60 * 1000)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  const login = async (email: string, pass: string) => {
    await pb.collection('users').authWithPassword(email, pass)
    setUser((pb.authStore.record as unknown as UserRecord) || null)
    setToken(pb.authStore.token || null)
  }

  const signup = async (email: string, pass: string, name: string) => {
    await pb.collection('users').create({
      email,
      password: pass,
      passwordConfirm: pass,
      name,
    })
    await pb.collection('users').requestVerification(email)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email)
  }

  const confirmPasswordReset = async (
    resetToken: string,
    password: string,
    passwordConfirm: string,
  ) => {
    await pb.collection('users').confirmPasswordReset(resetToken, password, passwordConfirm)
  }

  const confirmVerification = async (verifyToken: string) => {
    await pb.collection('users').confirmVerification(verifyToken)
  }

  const requestEmailChange = async (newEmail: string) => {
    await pb.collection('users').requestEmailChange(newEmail)
  }

  const confirmEmailChange = async (changeToken: string, password: string) => {
    await pb.collection('users').confirmEmailChange(changeToken, password)
    logout()
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      const authData = await pb.collection('users').authRefresh()
      setUser((authData.record as unknown as UserRecord) || null)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!pb.authStore.isValid || !pb.authStore.record?.id) {
      throw new Error('Você precisa estar logado para alterar a senha.')
    }
    await pb.collection('users').update(pb.authStore.record.id, {
      password: newPassword,
      passwordConfirm: newPassword,
      oldPassword: currentPassword,
    })
    // Ensure the auth store record is refreshed after the update
    await pb.collection('users').authRefresh()
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!token && !!user,
      login,
      signup,
      logout,
      requestPasswordReset,
      confirmPasswordReset,
      confirmVerification,
      requestEmailChange,
      confirmEmailChange,
      refreshUser,
      changePassword,
    }),
    [user, token, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
