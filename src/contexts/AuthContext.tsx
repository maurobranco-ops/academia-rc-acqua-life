import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types/database'

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

    // Initial check & auto refresh if token exists
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => {
          pb.authStore.clear()
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
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
