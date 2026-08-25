import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import type { ChargeOrder, Frequency, Status, Subscription, SubscriptionFilter } from '../types'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey } from '../constants'
import { formatCurrency, formatDate } from '../utils/format'
import { getNextChargeCountdown, normalizeAppKey } from '../utils/subscription'
import { ModalSurface } from '../components/ModalSurface'

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
  canManageSubscriptions: boolean
  currency: string
  appLogoCache: Record<string, string>
  isSyncing: boolean
  subscriptionsNotice: string
  openSubscriptionForm: (id: string | null) => void
  handleToggleSubscriptionStatus: (id: string, status: Status) => Promise<boolean>
  handleSoftDeleteSubscription: (id: string) => Promise<boolean>
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
  canManageSubscriptions,
  currency,
  appLogoCache,
  isSyncing,
  subscriptionsNotice,
  openSubscriptionForm,
  handleToggleSubscriptionStatus,
  handleSoftDeleteSubscription,
}: SubscriptionsViewProps) {
  const [pendingDelete, setPendingDelete] = useState<Subscription | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [statusErrorId, setStatusErrorId] = useState<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null)
  const reducedMotion = Boolean(useReducedMotion())
  const animateListLayout = !reducedMotion && visibleSubscriptions.length <= 40

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleteError('')
    const deleted = await handleSoftDeleteSubscription(pendingDelete.id)
    if (deleted) setPendingDelete(null)
    else setDeleteError('No se pudo eliminar la suscripción. Inténtalo de nuevo.')
  }

  const toggleStatus = async (item: Subscription) => {
    setStatusErrorId(null)
    const updated = await handleToggleSubscriptionStatus(item.id, item.status)
    if (!updated) setStatusErrorId(item.id)
  }

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
            aria-label={showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            aria-expanded={showAdvancedFilters}
            aria-controls="subscription-filters"
          >
            <SlidersHorizontal size={15} />
            {activeFilterCount > 0 && <span className="subs-filter-count">{activeFilterCount}</span>}
          </button>
          <button
            type="button"
            className="subs-add"
            onClick={() => openSubscriptionForm(null)}
            disabled={!canManageSubscriptions}
            aria-label="Añadir suscripción"
          >
            <Plus size={24} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {subscriptionsNotice && <p className="form-ok">{subscriptionsNotice}</p>}
      {!canManageSubscriptions && <p className="form-warn">Debes ser miembro activo del grupo para modificar gastos.</p>}

      {/* ── Search ──────────────────────────────── */}
      <input
        type="search"
        className="subs-search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Buscar por nombre, categoría…"
      />

      {/* ── Filters panel ───────────────────────── */}
      <AnimatePresence initial={false}>
        {showAdvancedFilters && (
          <motion.div
            className="subs-filters-wrap"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div id="subscription-filters" className="subs-filters">
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
          </motion.div>
        )}
      </AnimatePresence>

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
      <motion.ul layout={animateListLayout} className="subs-list">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleSubscriptions.map((item) => {
          const visual = getSubscriptionVisual(item.name, item.category, item.status)
          const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
          const cacheLogo = appLogoCache[normalizeAppKey(item.name)]
          const logoSrc = item.customLogoUrl || cacheLogo || visual.logoSrc

          return (
            <motion.li
              key={item.id}
              layout={animateListLayout ? 'position' : false}
              initial={reducedMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2, pointerEvents: 'none' }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
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
                <div className="subs-item-badges">
                  <span className={item.status === 'activa' ? 'dash-pill ok' : 'dash-pill'}>{item.status}</span>
                  {item.isFinanced && (
                    <span className="dash-pill finance-pill">
                      {item.financingProviderLogoUrl && <img src={item.financingProviderLogoUrl} alt="" />}
                      Financiado{item.financingProviderName ? ` · ${item.financingProviderName}` : ''}
                    </span>
                  )}
                </div>
                <div className="subs-item-links">
                  {canManageSubscriptions ? (
                    <>
                      <button type="button" disabled={isSyncing} onClick={() => void toggleStatus(item)}>
                        {item.status === 'activa' ? 'Cancelar' : 'Reactivar'}
                      </button>
                      <button type="button" onClick={() => openSubscriptionForm(item.id)}>Editar</button>
                      <button
                        type="button"
                        className="danger-link"
                        disabled={isSyncing}
                        onClick={() => { setDeleteError(''); setPendingDelete(item) }}
                      >Eliminar</button>
                    </>
                  ) : (
                    <span className="subs-readonly-note">Solo lectura</span>
                  )}
                </div>
              </div>
              {statusErrorId === item.id && (
                <p className="form-err subs-item-error" role="alert">No se pudo actualizar el estado. Inténtalo de nuevo.</p>
              )}
            </motion.li>
          )
          })}
        </AnimatePresence>
      </motion.ul>
      {visibleSubscriptions.length === 0 && (
        <div className="collection-empty">
          <strong>No hay resultados</strong>
          <span>Prueba con otro nombre o cambia los filtros activos.</span>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setSubscriptionFilter('all')
              setFrequencyFilter('all')
              setExcludedCategories([])
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <ModalSurface
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        titleId="delete-subscription-title"
        descriptionId="delete-subscription-description"
        initialFocusRef={cancelDeleteRef}
        closeDisabled={isSyncing}
        className="confirm-modal"
      >
        {pendingDelete && (
          <>
            <h2 id="delete-subscription-title">Eliminar suscripción</h2>
            <p id="delete-subscription-description">
              ¿Eliminar "{pendingDelete.name}"? Se ocultará de la lista, pero se conservará el histórico.
            </p>
            {deleteError && <p className="form-err" role="alert">{deleteError}</p>}
            <div className="confirm-modal-actions">
              <button ref={cancelDeleteRef} type="button" className="secondary" onClick={() => setPendingDelete(null)}>
                Cancelar
              </button>
              <button type="button" className="danger" disabled={isSyncing} onClick={() => void confirmDelete()}>
                {isSyncing ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </>
        )}
      </ModalSurface>
    </div>
  )
}
