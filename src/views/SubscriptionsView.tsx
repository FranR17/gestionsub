import { SlidersHorizontal } from 'lucide-react'
import type { ChargeOrder, Frequency, Status, Subscription, SubscriptionFilter } from '../types'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey } from '../constants'
import { formatCurrency, formatDate } from '../utils/format'
import { getNextChargeCountdown, normalizeAppKey } from '../utils/subscription'

export type SubscriptionsViewProps = {
  visibleSubscriptions: Subscription[]
  searchTerm: string
  setSearchTerm: (v: string) => void
  subscriptionFilter: SubscriptionFilter
  setSubscriptionFilter: (v: SubscriptionFilter) => void
  chargeOrder: ChargeOrder
  setChargeOrder: (v: ChargeOrder) => void
  frequencyFilter: Frequency | 'all'
  setFrequencyFilter: (v: Frequency | 'all') => void
  excludedCategories: string[]
  setExcludedCategories: (v: string[] | ((prev: string[]) => string[])) => void
  categorySearchTerm: string
  setCategorySearchTerm: (v: string) => void
  showAdvancedFilters: boolean
  setShowAdvancedFilters: (v: boolean | ((prev: boolean) => boolean)) => void
  availableCategories: string[]
  visibleCategoryOptions: string[]
  activeFilterCount: number
  currency: string
  appLogoCache: Record<string, string>
  isSyncing: boolean
  openSubscriptionForm: (id: string | null) => void
  handleToggleSubscriptionStatus: (id: string, status: Status) => Promise<void>
  handleSoftDeleteSubscription: (id: string) => Promise<void>
}

export function SubscriptionsView({
  visibleSubscriptions,
  searchTerm,
  setSearchTerm,
  subscriptionFilter,
  setSubscriptionFilter,
  chargeOrder,
  setChargeOrder,
  frequencyFilter,
  setFrequencyFilter,
  excludedCategories,
  setExcludedCategories,
  categorySearchTerm,
  setCategorySearchTerm,
  showAdvancedFilters,
  setShowAdvancedFilters,
  availableCategories,
  visibleCategoryOptions,
  activeFilterCount,
  currency,
  appLogoCache,
  isSyncing,
  openSubscriptionForm,
  handleToggleSubscriptionStatus,
  handleSoftDeleteSubscription,
}: SubscriptionsViewProps) {
  return (
    <div className="subs">
      {/* ── Header ──────────────────────────────── */}
      <div className="subs-top">
        <h1>Suscripciones</h1>
        <div className="subs-actions">
          <button
            type="button"
            className={showAdvancedFilters ? 'subs-filter active' : 'subs-filter'}
            onClick={() => setShowAdvancedFilters((current) => !current)}
          >
            <SlidersHorizontal size={15} />
            {activeFilterCount > 0 && <span className="subs-filter-count">{activeFilterCount}</span>}
          </button>
          <button
            type="button"
            className="subs-add"
            onClick={() => openSubscriptionForm(null)}
            aria-label="Añadir suscripción"
          >+</button>
        </div>
      </div>

      {/* ── Search ──────────────────────────────── */}
      <input
        type="search"
        className="subs-search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Buscar por nombre, categoría…"
      />

      {/* ── Filters panel ───────────────────────── */}
      {showAdvancedFilters && (
        <div className="subs-filters">
          <div className="subs-filters-row">
            <label>
              Orden
              <select value={chargeOrder} onChange={(e) => setChargeOrder(e.target.value as ChargeOrder)}>
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </label>
            <label>
              Frecuencia
              <select value={frequencyFilter} onChange={(e) => setFrequencyFilter(e.target.value as Frequency | 'all')}>
                <option value="all">Todas</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </label>
          </div>
          <div className="subs-cat-filter">
            <div className="subs-cat-head">
              <strong>Categorías</strong>
              <div className="subs-cat-links">
                <button type="button" className="link" onClick={() => setExcludedCategories([])}>Todas</button>
                <button type="button" className="link" onClick={() => setExcludedCategories(availableCategories)}>Ninguna</button>
              </div>
            </div>
            <input
              type="search"
              value={categorySearchTerm}
              onChange={(e) => setCategorySearchTerm(e.target.value)}
              placeholder="Buscar categoría"
            />
            <div className="subs-cat-pills">
              {visibleCategoryOptions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={!excludedCategories.includes(cat) ? 'active' : ''}
                  onClick={() => setExcludedCategories((c) => c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat])}
                >{cat}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Status tabs ─────────────────────────── */}
      <div className="subs-tabs">
        {(['all', 'activa', 'cancelada'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={subscriptionFilter === key ? 'active' : ''}
            onClick={() => setSubscriptionFilter(key)}
          >{key === 'all' ? 'Todas' : key === 'activa' ? 'Activas' : 'Canceladas'}</button>
        ))}
      </div>

      {/* ── List ────────────────────────────────── */}
      <ul className="subs-list">
        {visibleSubscriptions.map((item) => {
          const visual = getSubscriptionVisual(item.name, item.category, item.status)
          const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
          const cacheLogo = appLogoCache[normalizeAppKey(item.name)]
          const logoSrc = item.customLogoUrl || cacheLogo || visual.logoSrc

          return (
            <li key={item.id}>
              <div className="subs-item-top">
                <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                  {logoSrc && (
                    <img
                      src={logoSrc}
                      alt={item.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                        if (fallback) fallback.classList.add('show')
                      }}
                    />
                  )}
                  {!logoSrc && iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : null}
                  <span className={!logoSrc && iconOption ? 'hide-fallback' : ''}>
                    {item.name.trim().charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="subs-item-info">
                  <strong>{item.name}</strong>
                  <small>{item.frequency} · {formatDate(item.nextChargeDate)}</small>
                </div>
                <div className="subs-item-price">
                  <strong>{formatCurrency(item.amount, currency)}</strong>
                  <small>{getNextChargeCountdown(item.nextChargeDate, item.status)}</small>
                </div>
              </div>
              <div className="subs-item-foot">
                <span className={item.status === 'activa' ? 'dash-pill ok' : 'dash-pill'}>{item.status}</span>
                <div className="subs-item-links">
                  <button type="button" disabled={isSyncing} onClick={() => void handleToggleSubscriptionStatus(item.id, item.status)}>
                    {item.status === 'activa' ? 'Cancelar' : 'Reactivar'}
                  </button>
                  <button type="button" onClick={() => openSubscriptionForm(item.id)}>Editar</button>
                  <button
                    type="button"
                    className="danger-link"
                    disabled={isSyncing}
                    onClick={() => {
                      if (confirm(`¿Eliminar "${item.name}"? No se borrará el histórico.`)) {
                        void handleSoftDeleteSubscription(item.id)
                      }
                    }}
                  >Eliminar</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {visibleSubscriptions.length === 0 && (
        <p className="dash-empty">No hay suscripciones con ese filtro.</p>
      )}
    </div>
  )
}
