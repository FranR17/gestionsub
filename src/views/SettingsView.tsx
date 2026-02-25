import { useState } from 'react'
import type { ThemeMode } from '../types'
import { isNativePlatform } from '../utils/notifications'

export type SettingsViewProps = {
  currency: string
  setCurrency: (v: string) => void
  theme: ThemeMode
  setTheme: (v: ThemeMode) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (v: boolean) => void
  handleLogout: () => Promise<void>
  handleDeleteAccount: () => Promise<boolean>
  email: string
  subscriptionCount: number
  activeCount: number
  monthlyTotal: number
  formatCurrency: (amount: number, cur: string) => string
}

export function SettingsView({
  currency,
  setCurrency,
  theme,
  setTheme,
  notificationsEnabled,
  setNotificationsEnabled,
  handleLogout,
  handleDeleteAccount,
  email,
  subscriptionCount,
  activeCount,
  monthlyTotal,
  formatCurrency: fmtCurrency,
}: SettingsViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')

  const onDeleteAccount = async () => {
    setDeleteStep('deleting')
    const ok = await handleDeleteAccount()
    if (!ok) {
      setDeleteStep('idle')
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings-top">
        <h1>Ajustes</h1>
        <small>Preferencias y cuenta</small>
      </div>

      {/* ── Account ─────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Cuenta</p>
        <div className="settings-account-card">
          <div className="settings-account-avatar">
            {email ? email.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="settings-account-info">
            <strong>{email || 'Usuario local'}</strong>
            <span>{activeCount} suscripciones activas · {fmtCurrency(monthlyTotal, currency)}/mes</span>
          </div>
        </div>
      </section>

      {/* ── Appearance ──────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Apariencia</p>
        <label>
          Tema
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
            <option value="light">Claro ☀</option>
            <option value="dark">Oscuro 🌙</option>
          </select>
        </label>
        <label>
          Moneda
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="MXN">MXN ($)</option>
          </select>
        </label>
      </section>

      {/* ── Notifications ───────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Notificaciones</p>
        <label>
          Recordatorios
          <select value={notificationsEnabled ? 'on' : 'off'} onChange={(e) => setNotificationsEnabled(e.target.value === 'on')}>
            <option value="on">Activados</option>
            <option value="off">Desactivados</option>
          </select>
        </label>
      </section>

      {/* ── About ───────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Acerca de</p>
        <div className="settings-about">
          <div className="settings-about-row">
            <span>Versión</span>
            <strong>1.0.0</strong>
          </div>
          <div className="settings-about-row">
            <span>Suscripciones totales</span>
            <strong>{subscriptionCount}</strong>
          </div>
          <div className="settings-about-row">
            <span>Plataforma</span>
            <strong>{isNativePlatform() ? 'iOS' : 'Web'}</strong>
          </div>
        </div>
      </section>

      {/* ── Legal ───────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Legal</p>
        <a
          href="https://notifyra.app/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="settings-link"
        >
          Política de privacidad
        </a>
      </section>

      <button type="button" className="settings-logout" onClick={() => void handleLogout()}>
        Cerrar sesión
      </button>

      {/* ── Delete Account ──────────────────────── */}
      {!showDeleteConfirm ? (
        <button type="button" className="settings-delete" onClick={() => { setShowDeleteConfirm(true); setDeleteStep('confirm') }}>
          Eliminar cuenta
        </button>
      ) : (
        <div className="settings-delete-confirm">
          <p>¿Eliminar tu cuenta y todos tus datos? Esta acción es irreversible.</p>
          <div className="settings-delete-actions">
            <button type="button" className="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteStep('idle') }}>
              Cancelar
            </button>
            <button
              type="button"
              className="settings-delete-final"
              disabled={deleteStep === 'deleting'}
              onClick={() => void onDeleteAccount()}
            >
              {deleteStep === 'deleting' ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
