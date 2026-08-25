import { useRef, useState, type ChangeEvent } from 'react'
import type { PriceChange, ThemeMode } from '../types'
import { normalizeBudgetLimit } from '../utils/budget'
import { isNativePlatform } from '../utils/notifications'
import { CustomSelect } from '../components/CustomSelect'
import { ModalSurface } from '../components/ModalSurface'

const themeOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

const currencyOptions = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'MXN', label: 'MXN ($)' },
]

const notificationOptions = [
  { value: 'on', label: 'Activados' },
  { value: 'off', label: 'Desactivados' },
]

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
  accountError: string
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
  accountError,
}: SettingsViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showClearDeviceConfirm, setShowClearDeviceConfirm] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [isClearingDevice, setIsClearingDevice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const clearDeviceCancelRef = useRef<HTMLButtonElement | null>(null)
  const deleteAccountCancelRef = useRef<HTMLButtonElement | null>(null)

  const onDeleteAccount = async () => {
    setDeleteStep('deleting')
    const ok = await handleDeleteAccount()
    if (!ok) {
      setDeleteStep('confirm')
    }
  }

  const onClearDevice = async () => {
    setIsClearingDevice(true)
    await handleClearDeviceData()
    setIsClearingDevice(false)
    setShowClearDeviceConfirm(false)
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
        <div className="settings-field">
          <span>Tema</span>
          <CustomSelect value={theme} options={themeOptions} onChange={(value) => setTheme(value as ThemeMode)} ariaLabel="Tema" />
        </div>
        <div className="settings-field">
          <span>Moneda</span>
          <CustomSelect value={currency} options={currencyOptions} onChange={setCurrency} ariaLabel="Moneda" />
        </div>
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
        <div className="settings-field">
          <span>Recordatorios</span>
          <CustomSelect
            value={notificationsEnabled ? 'on' : 'off'}
            options={notificationOptions}
            onChange={(value) => setNotificationsEnabled(value === 'on')}
            ariaLabel="Recordatorios"
          />
        </div>
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
        {importStatus && <p className="form-ok" role="status">{importStatus}</p>}
        {importError && <p className="form-err" role="alert">{importError}</p>}
        <button type="button" className="settings-clear-device" onClick={() => setShowClearDeviceConfirm(true)}>
          Borrar datos de este dispositivo
        </button>
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
      <button type="button" className="settings-delete" onClick={() => { setShowDeleteConfirm(true); setDeleteStep('confirm') }}>
        Eliminar cuenta
      </button>

      <ModalSurface
        open={showClearDeviceConfirm}
        onClose={() => setShowClearDeviceConfirm(false)}
        titleId="clear-device-title"
        descriptionId="clear-device-description"
        initialFocusRef={clearDeviceCancelRef}
        closeDisabled={isClearingDevice}
        role="alertdialog"
        className="confirm-modal"
      >
        <h2 id="clear-device-title">Borrar datos del dispositivo</h2>
        <p id="clear-device-description">Borra sesión recordada, email, datos locales, pagos marcados, preferencias y caché PWA de este navegador.</p>
        <div className="confirm-modal-actions">
          <button ref={clearDeviceCancelRef} type="button" className="secondary" onClick={() => setShowClearDeviceConfirm(false)}>Cancelar</button>
          <button type="button" className="danger" disabled={isClearingDevice} onClick={() => void onClearDevice()}>
            {isClearingDevice ? 'Borrando…' : 'Sí, borrar'}
          </button>
        </div>
      </ModalSurface>

      <ModalSurface
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteStep('idle') }}
        titleId="delete-account-title"
        descriptionId="delete-account-description"
        initialFocusRef={deleteAccountCancelRef}
        closeDisabled={deleteStep === 'deleting'}
        role="alertdialog"
        className="confirm-modal"
      >
        <h2 id="delete-account-title">Eliminar cuenta</h2>
        <p id="delete-account-description">¿Eliminar tu cuenta y todos tus datos? Esta acción es irreversible.</p>
        {accountError && <p className="form-err" role="alert">{accountError}</p>}
        <div className="confirm-modal-actions">
          <button ref={deleteAccountCancelRef} type="button" className="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteStep('idle') }}>Cancelar</button>
          <button type="button" className="danger" disabled={deleteStep === 'deleting'} onClick={() => void onDeleteAccount()}>
            {deleteStep === 'deleting' ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </ModalSurface>
    </div>
  )
}
