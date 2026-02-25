import type { FormEvent } from 'react'
import type { AuthMode, ThemeMode } from '../types'
import { hasSupabase } from '../lib/supabase'

export type AuthScreenProps = {
  theme: ThemeMode
  authMode: AuthMode
  setAuthMode: (v: AuthMode | ((prev: AuthMode) => AuthMode)) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  formDisplayName: string
  setFormDisplayName: (v: string) => void
  authError: string
  authSuccess: string
  isSyncing: boolean
  pendingInviteToken: string
  handleAuthSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleOAuthLogin: (provider: 'google' | 'apple') => Promise<void>
}

export function AuthScreen({
  theme,
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
  authError,
  authSuccess,
  isSyncing,
  pendingInviteToken,
  handleAuthSubmit,
  handleOAuthLogin,
}: AuthScreenProps) {
  return (
    <main className={`app-shell ${theme}`}>
      <section className="screen auth-screen">
        <div className="auth-brand">
          <h1>GestiónSub</h1>
          <p>Controla tus suscripciones en segundos.</p>
        </div>
        {pendingInviteToken && (
          <div className="auth-invite">
            <span>🎉</span>
            <div>
              <strong>Tienes una invitación</strong>
              <small>{authMode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'} para aceptarla.</small>
            </div>
          </div>
        )}
        <form className="auth-form" onSubmit={(event) => void handleAuthSubmit(event)}>
          <label>Email<input name="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {authMode === 'register' && (
            <label>Tu nombre<input name="displayName" type="text" placeholder="Tu nombre visible" value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} /></label>
          )}
          <label>{authMode === 'register' ? 'Crear contraseña' : 'Contraseña'}<input name="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {authMode === 'register' && (
            <label>Confirmar<input name="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
          )}
          {authError && <p className="form-err">{authError}</p>}
          {authSuccess && <p className="form-ok">{authSuccess}</p>}
          <button type="submit" className="primary" disabled={isSyncing}>
            {isSyncing ? 'Conectando…' : authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
          {hasSupabase && (
            <div className="auth-oauth">
              <div className="auth-divider"><span>o continuar con</span></div>
              <div className="auth-oauth-buttons">
                <button type="button" className="auth-oauth-btn" disabled={isSyncing} onClick={() => void handleOAuthLogin('google')}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <button type="button" className="auth-oauth-btn" disabled={isSyncing} onClick={() => void handleOAuthLogin('apple')}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Apple
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="auth-switch"
            onClick={() => setAuthMode((c) => (c === 'login' ? 'register' : 'login'))}
          >
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}
