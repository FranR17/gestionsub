import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import type { AuthMode, Subscription, View } from '../types'
import { seedSubscriptions, storageKeys } from '../constants'
import { usePersistedState } from './usePersistedState'
import { readStorage } from '../utils/storage'

type UseAuthOptions = {
  loadSubscriptions: (uid: string) => Promise<void>
  loadGroupsContext: (uid: string, email: string) => Promise<void>
  handleAcceptInviteByToken: (token: string, uid: string, email?: string) => Promise<void>
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

    let isMounted = true

    const initSession = async () => {
      setIsSyncing(true)
      const { data: { session } } = await client.auth.getSession()
      if (!isMounted) return

      if (!session?.user) {
        setIsAuthenticated(false)
        setUserId(null)
        setIsSyncing(false)
        return
      }

      setIsAuthenticated(true)
      setUserId(session.user.id)
      await loadSubscriptions(session.user.id)
      await loadGroupsContext(session.user.id, session.user.email ?? '')
      setIsSyncing(false)
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

      // Auto-create profile for OAuth users on first sign-in
      if (_event === 'SIGNED_IN') {
        const meta = session.user.user_metadata ?? {}
        const displayName = meta.full_name || meta.name || session.user.email?.split('@')[0] || ''
        const avatarUrl = meta.avatar_url || meta.picture || ''
        await client.from('profiles').upsert(
          { id: session.user.id, display_name: displayName, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      }

      void loadSubscriptions(session.user.id)
      void loadGroupsContext(session.user.id, session.user.email ?? '')
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handleAuthSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode, confirmPassword, email, formDisplayName, password, pendingInviteToken])

  const handleLogout = useCallback(async () => {
    if (hasSupabase && supabase) {
      await supabase.auth.signOut()
    }
    setIsAuthenticated(false)
    setUserId(null)
    setActiveView('dashboard')
    setAuthMode('login')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSubscriptions(seedSubscriptions)
    resetGroups()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOAuthLogin = useCallback(async (provider: 'google' | 'apple') => {
    if (!hasSupabase || !supabase) return
    setAuthError('')
    setIsSyncing(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
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
    handleLogout,
  }
}
