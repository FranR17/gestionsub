import type { BeforeInstallPromptEvent, Group, Reminder, ThemeMode } from '../types'
import { hasSupabase } from '../lib/supabase'

export type SettingsViewProps = {
  isGroupProfileActive: boolean
  activeProfileContext: string
  groups: Group[]
  currency: string
  setCurrency: (v: string) => void
  theme: ThemeMode
  setTheme: (v: ThemeMode) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (v: boolean) => void
  defaultReminder: Reminder
  setDefaultReminder: (v: Reminder) => void
  pwaPrompt: BeforeInstallPromptEvent | null
  setPwaPrompt: (v: BeforeInstallPromptEvent | null) => void
  showInstallHelp: boolean
  setShowInstallHelp: (v: boolean | ((prev: boolean) => boolean)) => void
  handleChangeProfileContext: (value: string) => void
  handleExport: (format: 'json' | 'csv') => void
  handleLogout: () => Promise<void>
}

export function SettingsView({
  isGroupProfileActive,
  activeProfileContext,
  groups,
  currency,
  setCurrency,
  theme,
  setTheme,
  notificationsEnabled,
  setNotificationsEnabled,
  defaultReminder,
  setDefaultReminder,
  pwaPrompt,
  setPwaPrompt,
  showInstallHelp,
  setShowInstallHelp,
  handleChangeProfileContext,
  handleExport,
  handleLogout,
}: SettingsViewProps) {
  return (
    <div className="settings">
      <div className="settings-top">
        <h1>Ajustes</h1>
        <small>Preferencias y datos</small>
      </div>

      {/* ── Profile ─────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Perfil</p>
        <label>
          Perfil cargado
          <select
            value={isGroupProfileActive ? activeProfileContext : 'personal'}
            onChange={(e) => handleChangeProfileContext(e.target.value)}
          >
            <option value="personal">Personal</option>
            {groups.map((g) => <option key={g.id} value={`group:${g.id}`}>Grupo · {g.name}</option>)}
          </select>
        </label>
      </section>

      {/* ── Preferences ─────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Preferencias</p>
        <label>
          Moneda
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="MXN">MXN</option>
          </select>
        </label>
        <label>
          Tema
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <label>
          Recordatorios
          <select value={notificationsEnabled ? 'on' : 'off'} onChange={(e) => setNotificationsEnabled(e.target.value === 'on')}>
            <option value="on">Activados</option>
            <option value="off">Desactivados</option>
          </select>
        </label>
        <label>
          Aviso por defecto
          <select value={String(defaultReminder)} onChange={(e) => setDefaultReminder(Number(e.target.value) as Reminder)}>
            <option value="1">1 día</option>
            <option value="3">3 días</option>
            <option value="7">7 días</option>
          </select>
        </label>
      </section>

      {/* ── Install ─────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Instalar app</p>
        <p className="dash-empty">Instálala para usarla como app nativa.</p>
        {pwaPrompt ? (
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await pwaPrompt.prompt()
              void pwaPrompt.userChoice
              setPwaPrompt(null)
            }}
          >Instalar ahora</button>
        ) : (
          <button type="button" className="secondary" onClick={() => setShowInstallHelp((v) => !v)}>
            Ver instrucciones
          </button>
        )}
        {showInstallHelp && <small className="dash-empty">En iPhone: Safari → Compartir → Añadir a pantalla de inicio.</small>}
      </section>

      {/* ── Export ──────────────────────────────── */}
      <section className="settings-group">
        <p className="settings-label">Datos</p>
        <div className="settings-row">
          <button type="button" className="secondary" onClick={() => handleExport('json')}>Exportar JSON</button>
          <button type="button" className="secondary" onClick={() => handleExport('csv')}>Exportar CSV</button>
        </div>
        <small className="dash-empty">
          {hasSupabase ? 'Sincronización activa con Supabase.' : 'Modo local sin sincronización.'}
        </small>
      </section>

      <button type="button" className="settings-logout" onClick={() => void handleLogout()}>
        Cerrar sesión
      </button>
    </div>
  )
}
