import { useEffect, useRef, type FormEvent } from 'react'
import type { AppStoreResult, GroupMember, Reminder, Subscription, View } from '../types'
import { iconOptions } from '../constants'
import { formatCurrency } from '../utils/format'
import { equalSplit, fetchAppStoreResults, normalizeAppKey, pickBestAppMatch } from '../utils/subscription'
import { tomorrowIso } from '../utils/date'
import {
  Lightbulb, Droplets, ShoppingCart, Home, Shield, Dumbbell, Car, Wifi,
  Zap, GraduationCap, ChevronRight,
} from 'lucide-react'

const gatewayApps = [
  { initial: 'N',  search: 'Netflix',            bg: 'linear-gradient(135deg,#E50914,#B20710)', shadow: '#E50914' },
  { initial: 'S',  search: 'Spotify',            bg: 'linear-gradient(135deg,#1DB954,#169C46)', shadow: '#1DB954' },
  { initial: '▶',  search: 'YouTube',            bg: 'linear-gradient(135deg,#FF0000,#CC0000)', shadow: '#FF0000' },
  { initial: 'D+', search: 'Disney+',            bg: 'linear-gradient(135deg,#113CCF,#0B2A9E)', shadow: '#113CCF' },
  { initial: 'A',  search: 'Amazon Prime Video', bg: 'linear-gradient(135deg,#FF9900,#E68A00)', shadow: '#FF9900' },
  { initial: 'T',  search: 'Twitch',             bg: 'linear-gradient(135deg,#9146FF,#7732D9)', shadow: '#9146FF' },
  { initial: 'iC', search: 'iCloud',             bg: 'linear-gradient(135deg,#3693F3,#1A7AE0)', shadow: '#3693F3' },
  { initial: 'H',  search: 'HBO Max',            bg: 'linear-gradient(135deg,#B535F6,#9320D9)', shadow: '#B535F6' },
  { initial: 'G',  search: 'Google One',         bg: 'linear-gradient(135deg,#4285F4,#2B6FDB)', shadow: '#4285F4' },
  { initial: 'X',  search: 'X',                  bg: 'linear-gradient(135deg,#1D1D1F,#3a3a3c)', shadow: '#555555' },
  { initial: 'Li', search: 'LinkedIn',           bg: 'linear-gradient(135deg,#0A66C2,#084E96)', shadow: '#0A66C2' },
  { initial: 'O',  search: 'Microsoft 365',      bg: 'linear-gradient(135deg,#FF5500,#E04500)', shadow: '#FF5500' },
]

const gatewayServices = [
  { Icon: Lightbulb,      bg: '#FEF3C7', color: '#D97706' },
  { Icon: Droplets,       bg: '#DBEAFE', color: '#2563EB' },
  { Icon: ShoppingCart,   bg: '#D1FAE5', color: '#059669' },
  { Icon: Home,           bg: '#EDE9FE', color: '#7C3AED' },
  { Icon: Wifi,           bg: '#CFFAFE', color: '#0891B2' },
  { Icon: Dumbbell,       bg: '#FEE2E2', color: '#DC2626' },
  { Icon: Shield,         bg: '#E0E7FF', color: '#4F46E5' },
  { Icon: Car,            bg: '#FFEDD5', color: '#EA580C' },
  { Icon: Zap,            bg: '#FEF9C3', color: '#CA8A04' },
  { Icon: GraduationCap,  bg: '#FCE7F3', color: '#DB2777' },
]

export type FormViewProps = {
  editingSubscription: Subscription | null
  isGroupProfileActive: boolean
  activeProfileLabel: string
  selectedGroupMembers: GroupMember[]
  groupExpensePayerMemberId: string
  setGroupExpensePayerMemberId: (v: string) => void
  groupExpenseParticipantIds: string[]
  setGroupExpenseParticipantIds: (v: string[] | ((prev: string[]) => string[])) => void
  formName: string
  setFormName: (v: string) => void
  formCategory: string
  setFormCategory: (v: string) => void
  formCustomLogoUrl: string
  setFormCustomLogoUrl: (v: string) => void
  formAmount: number
  setFormAmount: (v: number) => void
  formIconKey: string
  setFormIconKey: (v: string) => void
  showIconPicker: boolean
  formEntryStep: 'choose' | 'details'
  setFormEntryStep: (v: 'choose' | 'details') => void
  isManualEntry: boolean
  setIsManualEntry: (v: boolean) => void
  appSearchTerm: string
  setAppSearchTerm: (v: string) => void
  appStoreResults: AppStoreResult[]
  appSearchLoading: boolean
  appSearchError: string
  currency: string
  isSyncing: boolean
  defaultReminder: Reminder
  handleNameBlur: (name: string) => Promise<void>
  handleSelectAppResult: (item: AppStoreResult) => void
  handleSaveSubscription: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setActiveView: (v: View) => void
  appLogoCache: Record<string, string>
  setAppLogoCache: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function FormView({
  editingSubscription,
  isGroupProfileActive,
  activeProfileLabel,
  selectedGroupMembers,
  groupExpensePayerMemberId,
  setGroupExpensePayerMemberId,
  groupExpenseParticipantIds,
  setGroupExpenseParticipantIds,
  formName,
  setFormName,
  formCategory,
  setFormCategory,
  formCustomLogoUrl,
  setFormCustomLogoUrl,
  formAmount,
  setFormAmount,
  formIconKey,
  setFormIconKey,
  showIconPicker,
  formEntryStep,
  setFormEntryStep,
  isManualEntry,
  setIsManualEntry,
  appSearchTerm,
  setAppSearchTerm,
  appStoreResults,
  appSearchLoading,
  appSearchError,
  currency,
  isSyncing,
  defaultReminder,
  handleNameBlur,
  handleSelectAppResult,
  handleSaveSubscription,
  setActiveView,
  appLogoCache,
  setAppLogoCache,
}: FormViewProps) {

  // ── Fetch gateway logos (abort when leaving gateway) ──
  const gatewayAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel any in-flight gateway logo fetches when leaving the gateway
    if (formEntryStep !== 'choose') {
      gatewayAbort.current?.abort()
      gatewayAbort.current = null
      return
    }

    const missing = gatewayApps.filter((a) => !appLogoCache[normalizeAppKey(a.search)])
    if (missing.length === 0) return

    const controller = new AbortController()
    gatewayAbort.current = controller

    const fetchLogos = async () => {
      for (const app of missing) {
        if (controller.signal.aborted) break
        try {
          const results = await fetchAppStoreResults(app.search, 3, controller.signal)
          const best = pickBestAppMatch(app.search, results)
          if (best?.iconUrl) {
            const key = normalizeAppKey(app.search)
            setAppLogoCache((cur) => (cur[key] ? cur : { ...cur, [key]: best.iconUrl }))
          }
        } catch { /* ignore (AbortError or network) */ }
        // Small delay to avoid iTunes API rate-limiting
        if (!controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, 250))
        }
      }
    }
    void fetchLogos()
    return () => { controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formEntryStep])

  // ── Gateway: choose entry mode (only for new, not editing) ──
  const showGateway = !editingSubscription && formEntryStep === 'choose'

  if (showGateway) {
    return (
      <div className="form-view form-view--gateway">
        {/* ── Top half: Nueva suscripción ── */}
        <button
          type="button"
          className="gateway-card gateway-card--apps"
          onClick={() => {
            setIsManualEntry(false)
            setFormEntryStep('details')
          }}
        >
          <div className="gateway-bg-glow gateway-bg-glow--apps" aria-hidden="true" />
          <div className="gateway-marquee" aria-hidden="true">
            {[0, 1].map((rowIdx) => {
              const row = gatewayApps.slice(rowIdx * 6, rowIdx * 6 + 6)
              return (
                <div
                  key={rowIdx}
                  className={`gateway-marquee-track ${rowIdx % 2 === 0 ? 'gateway-marquee-track--left' : 'gateway-marquee-track--right'}`}
                >
                  {[...row, ...row].map((app, i) => {
                    const logoUrl = appLogoCache[normalizeAppKey(app.search)]
                    return (
                      <span
                        key={i}
                        className={`gateway-tile${logoUrl ? ' has-logo' : ''}`}
                        style={{
                          background: logoUrl ? 'transparent' : app.bg,
                          boxShadow: `0 4px 14px ${app.shadow}50`,
                        }}
                      >
                        {logoUrl
                          ? <img src={logoUrl} alt={app.search} className="gateway-tile-logo" />
                          : app.initial}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div className="gateway-card-bottom">
            <div className="gateway-card-label">
              <strong>Nueva suscripción</strong>
              <small>Apps y servicios digitales</small>
            </div>
            <ChevronRight size={20} className="gateway-chevron" />
          </div>
        </button>

        {/* ── Bottom half: Gasto personalizado ── */}
        <button
          type="button"
          className="gateway-card gateway-card--services"
          onClick={() => {
            setIsManualEntry(true)
            setFormEntryStep('details')
            setFormName('')
            setFormCategory(isGroupProfileActive ? 'Grupo' : 'General')
            setFormCustomLogoUrl('')
            setFormIconKey('')
          }}
        >
          <div className="gateway-bg-glow gateway-bg-glow--services" aria-hidden="true" />
          <div className="gateway-marquee" aria-hidden="true">
            {[0, 1].map((rowIdx) => {
              const row = gatewayServices.slice(rowIdx * 5, rowIdx * 5 + 5)
              return (
                <div
                  key={rowIdx}
                  className={`gateway-marquee-track ${rowIdx % 2 === 0 ? 'gateway-marquee-track--left' : 'gateway-marquee-track--right'}`}
                >
                  {[...row, ...row].map((svc, i) => (
                    <span
                      key={i}
                      className="gateway-svc-item"
                      style={{ '--svc-bg': svc.bg, '--svc-color': svc.color } as React.CSSProperties}
                    >
                      <svc.Icon size={18} />
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="gateway-card-bottom">
            <div className="gateway-card-label">
              <strong>Gasto personalizado</strong>
              <small>Luz, agua, gimnasio, alquiler…</small>
            </div>
            <ChevronRight size={20} className="gateway-chevron" />
          </div>
        </button>
      </div>
    )
  }

  // ── Full form (details step or editing) ──
  return (
    <div className="form-view">
      <div className="form-top">
        <h1>{editingSubscription ? 'Editar' : isManualEntry ? 'Gasto personalizado' : 'Nueva suscripción'}</h1>
        <small>{isManualEntry ? 'Rellena los datos de tu gasto' : 'Completa los datos clave'}</small>
      </div>
      <form className="form-body" onSubmit={(event) => void handleSaveSubscription(event)}>
        {/* App store search only when NOT manual and NOT editing */}
        {!isManualEntry && !editingSubscription && (
          <>
            <label>
              Buscar en App Store
              <input
                type="search"
                value={appSearchTerm}
                onChange={(event) => {
                  const value = event.target.value
                  setAppSearchTerm(value)
                  if (formCustomLogoUrl) setFormCustomLogoUrl('')
                }}
                placeholder="Ej. Netflix, Spotify…"
              />
            </label>
            {(appSearchLoading || appSearchError || appStoreResults.length > 0 || appSearchTerm.trim().length >= 2) && (
              <div className="form-app-results">
                {appSearchLoading && <p className="dash-empty">Buscando…</p>}
                {!appSearchLoading && appSearchError && <p className="form-err">{appSearchError}</p>}
                {!appSearchLoading && !appSearchError && appStoreResults.length === 0 && appSearchTerm.trim().length >= 2 && (
                  <p className="dash-empty">Sin resultados.</p>
                )}
                {!appSearchLoading && appStoreResults.length > 0 && (
                  <ul className="form-app-list">
                    {appStoreResults.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => handleSelectAppResult(r)}>
                          <img src={r.iconUrl} alt="" loading="lazy" />
                          <div><strong>{r.name}</strong><small>{r.category}</small></div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
        <label>
          Nombre
          <input
            name="name"
            required
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            onBlur={(event) => {
              void handleNameBlur(event.target.value)
            }}
          />
        </label>
        <input type="hidden" name="iconKey" value={formIconKey} />
        {(showIconPicker || (isManualEntry && !formCustomLogoUrl)) && (
          <div className="icon-picker">
            <p className="muted">{isManualEntry ? 'Elige un icono para identificar este gasto:' : 'No encontramos logo automático. Elige un icono:'}</p>
            <div className="icon-grid">
              {iconOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={formIconKey === option.key ? 'icon-option active' : 'icon-option'}
                  onClick={() => setFormIconKey(option.key)}
                >
                  <option.Icon size={16} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label>
          Importe
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={formAmount || ''}
            onChange={(event) => setFormAmount(Number(event.target.value))}
          />
        </label>

        {/* ── Grupo: división del gasto ──────────────────────── */}
        {isGroupProfileActive && selectedGroupMembers.length > 0 && (() => {
          const participants = selectedGroupMembers.filter((m) =>
            groupExpenseParticipantIds.includes(m.id)
          )
          const allSelected = selectedGroupMembers.every((m) =>
            groupExpenseParticipantIds.includes(m.id)
          )
          const perPerson = participants.length > 0 && formAmount > 0
            ? equalSplit(formAmount, participants.length)
            : []

          return (
            <div className="group-split-section">
              <div className="group-split-badge">
                <span className="group-split-icon">👥</span>
                <span>Gasto compartido &middot; <strong>{activeProfileLabel}</strong></span>
              </div>

              {/* Quién pagó */}
              <div className="group-split-block">
                <p className="group-split-label">¿Quién pagó?</p>
                <div className="group-payer-grid">
                  {selectedGroupMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`group-payer-chip${groupExpensePayerMemberId === m.id ? ' active' : ''}`}
                      onClick={() => setGroupExpensePayerMemberId(m.id)}
                    >
                      <span className="group-member-avatar">{m.displayName.charAt(0).toUpperCase()}</span>
                      <span>{m.displayName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Participantes */}
              <div className="group-split-block">
                <div className="group-split-label-row">
                  <p className="group-split-label">Participantes</p>
                  <button
                    type="button"
                    className="link group-toggle-all"
                    onClick={() =>
                      allSelected
                        ? setGroupExpenseParticipantIds([])
                        : setGroupExpenseParticipantIds(selectedGroupMembers.map((m) => m.id))
                    }
                  >
                    {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="group-participants-grid">
                  {selectedGroupMembers.map((m) => {
                    const checked = groupExpenseParticipantIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`group-participant-chip${checked ? ' active' : ''}`}
                        onClick={() => {
                          setGroupExpenseParticipantIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== m.id)
                              : [...prev, m.id]
                          )
                        }}
                      >
                        <span className="group-member-avatar small">{m.displayName.charAt(0).toUpperCase()}</span>
                        <span className="group-participant-name">{m.displayName}</span>
                        {checked && <span className="group-participant-check">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Vista previa de la división */}
              {participants.length > 0 && formAmount > 0 && (
                <div className="group-split-block">
                  <p className="group-split-label">División del gasto</p>
                  <div className="split-preview-list">
                    {participants.map((m, index) => {
                      const isPayer = m.id === groupExpensePayerMemberId
                      const share = perPerson[index] ?? 0
                      const owes = isPayer ? share - formAmount : share
                      return (
                        <div key={m.id} className={`split-preview-row${isPayer ? ' is-payer' : ''}`}>
                          <span className="split-preview-avatar">{m.displayName.charAt(0).toUpperCase()}</span>
                          <div className="split-preview-info">
                            <span className="split-preview-name">{m.displayName}</span>
                            {isPayer && <span className="split-payer-tag">Pagó todo</span>}
                          </div>
                          <div className="split-preview-amounts">
                            <span className="split-share">{formatCurrency(share, currency)}</span>
                            {participants.length > 1 && (
                              <span className={`split-balance ${isPayer ? 'receives' : 'owes'}`}>
                                {isPayer
                                  ? `Recupera ${formatCurrency(formAmount - share, currency)}`
                                  : `Debe ${formatCurrency(Math.abs(owes), currency)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="split-total-row">
                    <span>Total</span>
                    <strong>{formatCurrency(formAmount, currency)}</strong>
                  </div>
                </div>
              )}

              {participants.length === 0 && (
                <p className="group-split-warning">Selecciona al menos un participante.</p>
              )}
            </div>
          )
        })()}

        <label>
          Frecuencia
          <select name="frequency" defaultValue={editingSubscription?.frequency ?? 'mensual'}>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>
        </label>
        <label>
          Próximo cobro
          <input
            name="nextChargeDate"
            type="date"
            required
            defaultValue={editingSubscription?.nextChargeDate ?? tomorrowIso()}
          />
        </label>
        <label>
          Categoría
          <input
            name="category"
            required
            value={formCategory}
            onChange={(event) => setFormCategory(event.target.value)}
          />
        </label>
        <label>
          Recordatorio
          <select
            name="reminderDays"
            defaultValue={String(editingSubscription?.reminderDays ?? defaultReminder)}
          >
            <option value="1">1 día antes</option>
            <option value="3">3 días antes</option>
            <option value="7">7 días antes</option>
          </select>
        </label>
        <label>
          Estado
          <select name="status" defaultValue={editingSubscription?.status ?? 'activa'}>
            <option value="activa">Activa</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => {
            if (!editingSubscription) {
              setFormEntryStep('choose')
              setIsManualEntry(false)
            }
            setActiveView('subscriptions')
          }}>
            Cancelar
          </button>
          <button type="submit" className="primary" disabled={isSyncing}>
            {isSyncing ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
