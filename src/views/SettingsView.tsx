import { useRef, useState, type ChangeEvent } from 'react'
import type { PriceChange, ThemeMode } from '../types'
import { normalizeBudgetLimit } from '../utils/budget'
import { isNativePlatform } from '../utils/notifications'

export type SettingsViewProps = {
  currency: string
  setCurrency: (v: string) => void
  theme: ThemeMode
  setTheme: (v: ThemeMode) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (v: boolean) => void
  monthlyBudget: number
  setMonthlyBudget: (v: number | ((prev: number) => number)) => void
  isOffline: boolean
  handleLogout: () => Promise<void>
  handleClearDeviceData: () => Promise<void>
  handleDeleteAccount: () => Promise<boolean>
  email: string
  subscriptionCount: number
  activeCount: number
  monthlyTotal: number
  formatCurrency: (amount: number, cur: string) => string
  priceHistory: PriceChange[]
  handleImportFile: (file: File) => Promise<void>
  importStatus: string
  importError: string
}

export function SettingsView({
  currency,
  setCurrency,
  theme,
  setTheme,
  notificationsEnabled,
  setNotificationsEnabled,
  monthlyBudget,
  setMonthlyBudget,
  isOffline,
  handleLogout,
  handleClearDeviceData,
  handleDeleteAccount,
  email,
  subscriptionCount,
  activeCount,
  monthlyTotal,
  formatCurrency: fmtCurrency,
  priceHistory,
  handleImportFile,
  importStatus,
  importError,
}: SettingsViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showClearDeviceConfirm, setShowClearDeviceConfirm] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const onDeleteAccount = async () => {
    setDeleteStep('deleting')
    const ok = await handleDeleteAccount()
    if (!ok) {
      setDeleteStep('idle')
      setShowDeleteConfirm(false)
    }
  }

  const onImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void handleImportFile(file)
    event.target.value = ''
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

      <section className="settings-group">
        <p className="settings-label">Presupuesto</p>
        <label>
          Límite mensual
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyBudget || ''}
            onChange={(e) => setMonthlyBudget(normalizeBudgetLimit(Number(e.target.value)))}
            placeholder="Sin límite"
          />
          <small className="settings-help">Déjalo vacío o en 0 para desactivar el aviso de presupuesto.</small>
        </label>
      </section>

      <section className="settings-group">
        <p className="settings-label">Historial de precios</p>
        {priceHistory.length === 0 ? (
          <p className="settings-empty">Sin cambios de precio registrados todavía.</p>
        ) : (
          <div className="settings-price-history">
            {priceHistory.slice(0, 5).map((change) => {
              const delta = change.nextAmount - change.previousAmount
              return (
                <div key={change.id} className="settings-price-row">
                  <div>
                    <strong>{change.subscriptionName}</strong>
                    <span>{new Date(change.changedAt).toLocaleDateString('es-ES')}</span>
                  </div>
                  <p className={delta > 0 ? 'up' : 'down'}>
                    {fmtCurrency(change.previousAmount, currency)} → {fmtCurrency(change.nextAmount, currency)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
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

      <section className="settings-group">
        <p className="settings-label">Datos</p>
        {isOffline && <p className="form-warn">Sin conexión: la importación en nube necesita recuperar internet.</p>}
        <button type="button" className="settings-link" onClick={() => fileInputRef.current?.click()}>
          Importar suscripciones JSON/CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,text/csv,.json,.csv"
          onChange={onImportChange}
          hidden
        />
        {importStatus && <p className="form-ok">{importStatus}</p>}
        {importError && <p className="form-err">{importError}</p>}
        {!showClearDeviceConfirm ? (
          <button type="button" className="settings-clear-device" onClick={() => setShowClearDeviceConfirm(true)}>
            Borrar datos de este dispositivo
          </button>
        ) : (
          <div className="settings-delete-confirm">
            <p>Borra sesión recordada, email, datos locales, pagos marcados, preferencias y caché PWA de este navegador.</p>
            <div className="settings-delete-actions">
              <button type="button" className="secondary" onClick={() => setShowClearDeviceConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className="settings-delete-final" onClick={() => void handleClearDeviceData()}>
                Sí, borrar
              </button>
            </div>
          </div>
        )}
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
