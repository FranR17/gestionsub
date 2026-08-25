import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { hasSupabase, supabase } from '../lib/supabase'
import type { AuthMode, Subscription, View } from '../types'
import { seedSubscriptions, storageKeys } from '../constants'
import { usePersistedState } from './usePersistedState'
import { readStorage } from '../utils/storage'

async function ensureUserProfile(client: SupabaseClient, user: User) {
  const meta = user.user_metadata ?? {}
  const metaName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : ''
  const metaAvatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : ''
  const displayName = metaName.trim() || user.email?.split('@')[0] || ''

  await client.from('profiles').upsert(
    { id: user.id, display_name: displayName, ...(metaAvatar ? { avatar_url: metaAvatar } : {}) },
    { onConflict: 'id', ignoreDuplicates: true },
  )
}

type UseAuthOptions = {
  loadSubscriptions: (uid: string) => Promise<void>
  loadGroupsContext: (uid: string, email: string) => Promise<void>
  handleAcceptInviteByToken: (token: string, uid: string, email?: string) => Promise<boolean>
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>
  resetGroups: () => void
  setActiveView: (v: View) => void
  pendingInviteToken: string
}

export function useAuth(options: UseAuthOptions) {
  const {
    loadSubscriptions,
    loadGroupsContext,
    handleAcceptInviteByToken,
    setSubscriptions,
    resetGroups,
    setActiveView,
    pendingInviteToken,
  } = options

  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    hasSupabase ? false : readStorage<boolean>(storageKeys.session, false),
  )
  const [isDevSession, setIsDevSession] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authMode, setAuthMode] = usePersistedState<AuthMode>(storageKeys.authMode, 'login')
  const [email, setEmail] = usePersistedState(storageKeys.email, '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')

  // Persist session for non-supabase mode
  useEffect(() => {
    if (!hasSupabase) {
      localStorage.setItem(storageKeys.session, JSON.stringify(isAuthenticated))
    }
  }, [isAuthenticated])

  // Supabase session init + listener
  useEffect(() => {
    const client = supabase
    if (!hasSupabase || !client) return
    if (import.meta.env.DEV && isDevSession) return

    let isMounted = true

    const initSession = async () => {
      setIsSyncing(true)
      try {
        const { data: { session } } = await client.auth.getSession()
        if (!isMounted) return

        if (!session?.user) {
          setIsAuthenticated(false)
          setUserId(null)
          return
        }

        setEmail(session.user.email ?? '')
        await ensureUserProfile(client, session.user)
        setIsAuthenticated(true)
        setUserId(session.user.id)
        await loadSubscriptions(session.user.id)
        await loadGroupsContext(session.user.id, session.user.email ?? '')
      } finally {
        if (isMounted) setIsSyncing(false)
      }
    }

    void initSession()

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      if (!session?.user) {
        setIsAuthenticated(false)
        setUserId(null)
        return
      }
      setIsAuthenticated(true)
      setUserId(session.user.id)
      setEmail(session.user.email ?? '')

      // Auto-create profile for OAuth users on first sign-in.
      if (_event === 'SIGNED_IN') {
        await ensureUserProfile(client, session.user)
      }

      void loadSubscriptions(session.user.id)
      void loadGroupsContext(session.user.id, session.user.email ?? '')
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  // Auth bootstrap must not rerun when downstream loaders change after group/profile state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handleAuthSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsDevSession(false)
    setAuthError('')
    setAuthSuccess('')

    if (authMode === 'register' && password !== confirmPassword) {
      setAuthError('Las contraseñas no coinciden.')
      return
    }

    if (!email || !password) {
      setAuthError('Completa email y contraseña.')
      return
    }

    if (!hasSupabase || !supabase) {
      setIsAuthenticated(true)
      setPassword('')
      setConfirmPassword('')
      setActiveView('dashboard')
      return
    }

    setIsSyncing(true)
    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setAuthError(error.message)
          setIsSyncing(false)
          return
        }

        if (data.user?.id) {
          const displayNameTrimmed = formDisplayName.trim() || email.split('@')[0]
          await supabase.from('profiles').upsert(
            { id: data.user.id, display_name: displayNameTrimmed },
            { onConflict: 'id' },
          )
        }

        if (!data.session) {
          setAuthSuccess('Registro completado. Revisa tu email y luego inicia sesión.')
          setAuthMode('login')
          setPassword('')
          setConfirmPassword('')
          setIsSyncing(false)
          return
        }

        setIsAuthenticated(true)
        setUserId(data.user?.id ?? null)
        if (data.user?.id) {
          await loadSubscriptions(data.user.id)
          await loadGroupsContext(data.user.id, data.user.email ?? email)
          if (pendingInviteToken) {
            await handleAcceptInviteByToken(pendingInviteToken, data.user.id, data.user.email ?? email)
          }
        }
        setPassword('')
        setConfirmPassword('')
        setActiveView('dashboard')
        setIsSyncing(false)
        return
      }

      // Login
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message)
        setIsSyncing(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setAuthError('No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.')
        setIsSyncing(false)
        return
      }

      setIsAuthenticated(true)
      setUserId(session.user.id)
      await loadSubscriptions(session.user.id)
      await loadGroupsContext(session.user.id, session.user.email ?? email)
      if (pendingInviteToken) {
        await handleAcceptInviteByToken(pendingInviteToken, session.user.id, session.user.email ?? email)
      }
      setPassword('')
      setConfirmPassword('')
      setActiveView('dashboard')
      setIsSyncing(false)
    } catch {
      setAuthError('No se pudo conectar con Supabase. Revisa VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y reinicia npm run dev.')
      setIsSyncing(false)
    }
  // Submit reads the latest form state but intentionally avoids loader-driven dependency churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode, confirmPassword, email, formDisplayName, password, pendingInviteToken])

  const handleLogout = useCallback(async () => {
    if (hasSupabase && supabase) {
      await supabase.auth.signOut()
    }
    setIsAuthenticated(false)
    setIsDevSession(false)
    setUserId(null)
    setActiveView('dashboard')
    setAuthMode('login')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSubscriptions(seedSubscriptions)
    resetGroups()
  // Logout should remain a stable event handler and not be recreated by reset helper changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOAuthLogin = useCallback(async (provider: 'google' | 'apple') => {
    if (!hasSupabase || !supabase) return
    setIsDevSession(false)
    setAuthError('')
    setIsSyncing(true)
    try {
      const redirectTo = import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (error) {
        setAuthError(error.message)
        setIsSyncing(false)
      }
      // Redirect happens — isSyncing stays true
    } catch {
      setAuthError('No se pudo iniciar el login social.')
      setIsSyncing(false)
    }
  }, [])

  const handleDevLogin = useCallback(() => {
    if (!import.meta.env.DEV) return
    setIsDevSession(true)
    setAuthError('')
    setAuthSuccess('')
    setIsSyncing(false)
    setIsAuthenticated(true)
    setUserId(null)
    if (!email) setEmail('dev@notifyra.local')
    setPassword('')
    setConfirmPassword('')
    setActiveView('dashboard')
  }, [email, setActiveView, setEmail])

  const handleDeleteAccount = useCallback(async (): Promise<boolean> => {
    setAuthError('')
    if (!hasSupabase || !supabase) {
      setAuthError('No hay una cuenta sincronizada que eliminar en esta sesión local.')
      return false
    }
    try {
      // Call Supabase Edge Function or RPC to delete user
      // The admin.deleteUser is server-side only, so we use rpc
      const { error } = await supabase.rpc('delete_own_account')
      if (error) {
        setAuthError('No se pudo eliminar la cuenta: ' + error.message)
        return false
      }
      // Sign out and reset everything
      await supabase.auth.signOut()
      setIsAuthenticated(false)
      setIsDevSession(false)
      setUserId(null)
      setActiveView('dashboard')
      setAuthMode('login')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setSubscriptions(seedSubscriptions)
      resetGroups()
      return true
    } catch {
      setAuthError('Error al eliminar la cuenta.')
      return false
    }
  // Account deletion resets app state once; keep it independent from view/group callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isAuthenticated,
    userId,
    isSyncing,
    setIsSyncing,
    authError,
    authSuccess,
    authMode,
    setAuthMode,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    formDisplayName,
    setFormDisplayName,
    handleAuthSubmit,
    handleOAuthLogin,
    handleDevLogin,
    handleLogout,
    handleDeleteAccount,
  }
}
