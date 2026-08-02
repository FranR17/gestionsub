import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import type {
  AppStoreResult,
  ChargeOrder,
  Frequency,
  GroupMember,
  Reminder,
  PriceChange,
  Status,
  Subscription,
  SubscriptionFilter,
  SupabaseSubscriptionRow,
  View,
} from '../types'
import { seedSubscriptions, storageKeys } from '../constants'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { diffInDays } from '../utils/date'
import { formatCurrency, formatDate } from '../utils/format'
import {
  equalSplit,
  fetchAppStoreResults,
  fromSupabaseRow,
  normalizeAppKey,
  normalizeReminder,
  pickBestAppMatch,
} from '../utils/subscription'
import {
  getActiveCurrentCycleSubscriptions,
  getActiveSubscriptions,
  getCategoryBreakdown,
  getCurrentCycleSubscriptions,
  getMonthlyProjection,
  getNonDeletedSubscriptions,
  getPeriodTotalForCurrentMonth,
  getPeriodTotalForCurrentYear,
  getSpendingHistory,
  getUniqueSubscriptionsById,
  getUpcomingSubscriptions,
} from '../utils/subscriptionAnalytics'
import {
  buildSubscriptionsExportPayload,
  normalizeImportedSubscription,
  parseExportedSubscriptionsCsv,
} from '../utils/subscriptionImportExport'
import {
  subscriptionSelectColumns,
  toSupabaseImportedSubscriptionInsert,
  toSupabaseSubscriptionInsert,
  toSupabaseSubscriptionPayload,
} from '../utils/subscriptionPersistence'
import {
  getActiveFilterCount,
  getAvailableCategories,
  getVisibleCategoryOptions,
  getVisibleSubscriptions,
} from '../utils/subscriptionFilters'
import { usePersistedState } from './usePersistedState'
import { readStorage } from '../utils/storage'
import {
  isNativePlatform,
  scheduleAllNotifications,
  fireWebNotification,
} from '../utils/notifications'
import { appendPriceChange, createPriceChange } from '../utils/priceHistory'

const getSaveErrorMessage = (message?: string) => {
  const details = message?.trim()
  if (!details) return 'No se pudo guardar. Inténtalo de nuevo.'
  return `No se pudo guardar: ${details}`
}

const getImportErrorMessage = (message?: string) => {
  const details = message?.trim()
  if (!details) return 'No se pudo importar el archivo.'
  return `No se pudo importar: ${details}`
}

type UseSubscriptionsOptions = {
  userId: string | null
  isGroupProfileActive: boolean
  effectiveSelectedGroupId: string
  groupScopedSubscriptions: Subscription[]
  selectedGroupMembers: GroupMember[]
  groupExpensePayerMemberId: string
  groupExpenseParticipantIds: string[]
  setGroupExpensePayerMemberId: (v: string) => void
  setGroupExpenseParticipantIds: (v: string[]) => void
  appLogoCache: Record<string, string>
  setAppLogoCache: React.Dispatch<React.SetStateAction<Record<string, string>>>
  currency: string
  notificationsEnabled: boolean
  defaultReminder: Reminder
  isAuthenticated: boolean
  setIsSyncing: (v: boolean) => void
  activeView: View
  setActiveView: (v: View) => void
  loadGroupScopedSubscriptions: (groupId: string) => Promise<void>
  loadGroupMonthBalances: (groupId: string) => Promise<void>
  setGroupsError: (v: string) => void
}

export function useSubscriptions(options: UseSubscriptionsOptions) {
  const {
    userId,
    isGroupProfileActive,
    effectiveSelectedGroupId,
    groupScopedSubscriptions,
    selectedGroupMembers,
    groupExpensePayerMemberId,
    groupExpenseParticipantIds,
    setGroupExpensePayerMemberId,
    setGroupExpenseParticipantIds,
    appLogoCache,
    setAppLogoCache,
    currency,
    notificationsEnabled,
    isAuthenticated,
    setIsSyncing,
    activeView,
    setActiveView,
    loadGroupScopedSubscriptions,
    loadGroupMonthBalances,
    setGroupsError,
  } = options

  const [subscriptions, setSubscriptions] = usePersistedState<Subscription[]>(
    storageKeys.subscriptions,
    seedSubscriptions,
    (items) => items.map((item, index) => ({
      ...item,
      id: String(item.id ?? `local-${index + 1}`),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
      reminderDays: normalizeReminder(Number(item.reminderDays ?? 3)),
      reminderTime: String(item.reminderTime ?? '09:00'),
      paymentEndDate: item.paymentEndDate ? String(item.paymentEndDate) : null,
      isFinanced: Boolean(item.isFinanced),
      financingProviderName: item.financingProviderName ? String(item.financingProviderName) : null,
      financingProviderLogoUrl: item.financingProviderLogoUrl ? String(item.financingProviderLogoUrl) : null,
      anulado: (item.anulado === 1 ? 1 : 0) as 0 | 1,
    })),
  )
  const [priceHistory, setPriceHistory] = usePersistedState<PriceChange[]>(storageKeys.priceHistory, [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [formCustomLogoUrl, setFormCustomLogoUrl] = useState('')
  const [formAmount, setFormAmount] = useState(0)
  const [formIconKey, setFormIconKey] = useState('')
  const [formIsFinanced, setFormIsFinanced] = useState(false)
  const [formFinancingProviderName, setFormFinancingProviderName] = useState('')
  const [formFinancingProviderLogoUrl, setFormFinancingProviderLogoUrl] = useState('')
  const [financingProviderSearchTerm, setFinancingProviderSearchTerm] = useState('')
  const [financingProviderResults, setFinancingProviderResults] = useState<AppStoreResult[]>([])
  const [financingProviderSearchLoading, setFinancingProviderSearchLoading] = useState(false)
  const [financingProviderSearchError, setFinancingProviderSearchError] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [formEntryStep, setFormEntryStep] = useState<'choose' | 'details'>('choose')
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [appSearchTerm, setAppSearchTerm] = useState('')
  const [appStoreResults, setAppStoreResults] = useState<AppStoreResult[]>([])
  const [appSearchLoading, setAppSearchLoading] = useState(false)
  const [appSearchError, setAppSearchError] = useState('')
  const [formSaveError, setFormSaveError] = useState('')
  const [subscriptionsNotice, setSubscriptionsNotice] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [importError, setImportError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>('activa')
  const [chargeOrder, setChargeOrder] = useState<ChargeOrder>('asc')
  const [frequencyFilter, setFrequencyFilter] = useState<Frequency | 'all'>('all')
  const [excludedCategories, setExcludedCategories] = useState<string[]>([])
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [groupSplitMode, setGroupSplitMode] = useState<'equal' | 'custom'>('equal')
  const [groupCustomShares, setGroupCustomShares] = useState<Record<string, number>>({})

  // ── Loaders ────────────────────────────────
  const loadSubscriptions = useCallback(async (uid: string) => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('subscriptions')
      .select(subscriptionSelectColumns)
      .eq('user_id', uid)
      .eq('anulado', 0)
      .order('next_charge_date', { ascending: true })

    if (error) return

    setSubscriptions(
      (data as unknown as SupabaseSubscriptionRow[]).map((row) => fromSupabaseRow(row)),
    )
  }, [setSubscriptions])

  // ── Scoped / computed ──────────────────────
  const nonAnulado = useMemo(() => getNonDeletedSubscriptions(subscriptions), [subscriptions])
  const scopedSubscriptions = isGroupProfileActive ? groupScopedSubscriptions : nonAnulado

  const activeSubscriptions = useMemo(
    () => getActiveCurrentCycleSubscriptions(scopedSubscriptions),
    [scopedSubscriptions],
  )

  const effectiveSubscriptions = useMemo(
    () => getCurrentCycleSubscriptions(scopedSubscriptions),
    [scopedSubscriptions],
  )

  // ── KPI totals ─────────────────────────────
  const personalActiveItems = useMemo(() => getActiveSubscriptions(subscriptions), [subscriptions])
  const groupActiveItems = useMemo(() => getActiveSubscriptions(groupScopedSubscriptions), [groupScopedSubscriptions])
  const combinedActiveItems = useMemo(() => getUniqueSubscriptionsById([...personalActiveItems, ...groupActiveItems]), [personalActiveItems, groupActiveItems])

  const personalMonthTotal = useMemo(() => getPeriodTotalForCurrentMonth(personalActiveItems), [personalActiveItems])

  const groupOnlyMonthTotal = useMemo(() => getPeriodTotalForCurrentMonth(groupActiveItems), [groupActiveItems])

  const combinedMonthTotal = useMemo(() => getPeriodTotalForCurrentMonth(combinedActiveItems), [combinedActiveItems])

  const groupOnlyYearTotal = useMemo(() => getPeriodTotalForCurrentYear(groupActiveItems), [groupActiveItems])

  const personalYearTotal = useMemo(() => getPeriodTotalForCurrentYear(personalActiveItems), [personalActiveItems])

  // ── Upcoming / Charges ─────────────────────
  const upcomingCharges = useMemo(() => getUpcomingSubscriptions(activeSubscriptions, 7), [activeSubscriptions])

  const todayCharges = useMemo(() => upcomingCharges.filter((item) => item.inDays === 0), [upcomingCharges])

  const upcoming30 = useMemo(() => getUpcomingSubscriptions(activeSubscriptions, 30), [activeSubscriptions])

  // ── Category breakdown ─────────────────────
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(activeSubscriptions), [activeSubscriptions])

  const topExpensive = useMemo(() => [...activeSubscriptions].sort((a, b) => b.amount - a.amount).slice(0, 3), [activeSubscriptions])

  // ── Monthly projection ─────────────────────
  const monthlyProjection = useMemo(() => getMonthlyProjection(activeSubscriptions), [activeSubscriptions])

  // ── Spending history ───────────────────────
  const spendingHistory = useMemo(() => getSpendingHistory(effectiveSubscriptions), [effectiveSubscriptions])

  // ── Filters & visible ──────────────────────
  const availableCategories = useMemo(() => getAvailableCategories(effectiveSubscriptions), [effectiveSubscriptions])

  const visibleCategoryOptions = useMemo(() => getVisibleCategoryOptions(availableCategories, categorySearchTerm), [availableCategories, categorySearchTerm])

  const activeFilterCount = getActiveFilterCount({ chargeOrder, frequencyFilter, excludedCategories })

  const visibleSubscriptions = useMemo(() => getVisibleSubscriptions(effectiveSubscriptions, {
    subscriptionFilter,
    frequencyFilter,
    excludedCategories,
    searchTerm,
    chargeOrder,
  }), [chargeOrder, effectiveSubscriptions, excludedCategories, frequencyFilter, searchTerm, subscriptionFilter])

  const editingSubscription = effectiveSubscriptions.find((item) => item.id === editingId) ?? null

  // ── Notification reminders ─────────────────
  // Native: schedule local notifications via Capacitor
  useEffect(() => {
    if (!notificationsEnabled || activeSubscriptions.length === 0) return
    if (isNativePlatform()) {
      scheduleAllNotifications(activeSubscriptions, currency).catch(() => {})
    }
  }, [activeSubscriptions, currency, notificationsEnabled])

  // Web fallback: fire browser notifications once per day
  useEffect(() => {
    if (!isAuthenticated || !notificationsEnabled || isNativePlatform()) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') { void Notification.requestPermission(); return }
    if (Notification.permission !== 'granted') return

    const today = new Date()
    // Include a fingerprint of reminder settings so changes re-trigger
    const reminderFingerprint = activeSubscriptions
      .map((s) => `${s.id}:${s.reminderDays}:${s.reminderTime}:${s.nextChargeDate}`)
      .sort()
      .join('|')
    const digestKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}::${reminderFingerprint}`
    const lastDigest = readStorage<string>(storageKeys.reminderDigest, '')
    if (lastDigest === digestKey) return

    const dueReminders = activeSubscriptions.filter((item) => {
      const days = diffInDays(today, new Date(`${item.nextChargeDate}T12:00:00`))
      return days >= 0 && days === item.reminderDays
    })
    if (dueReminders.length === 0) return

    dueReminders.forEach((item) => {
      fireWebNotification(
        'Recordatorio de suscripción',
        `${item.name}: cobro el ${formatDate(item.nextChargeDate)} por ${formatCurrency(item.amount, currency)}.`,
      )
    })
    localStorage.setItem(storageKeys.reminderDigest, JSON.stringify(digestKey))
  }, [activeSubscriptions, currency, isAuthenticated, notificationsEnabled])

  // ── App Store search ───────────────────────
  useEffect(() => {
    if (activeView !== 'form') return
    const term = appSearchTerm.trim()
    if (term.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setAppSearchLoading(true)
      setAppSearchError('')
      void fetchAppStoreResults(term, 20, controller.signal)
        .then((mapped) => setAppStoreResults(mapped))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setAppSearchError('No se pudo buscar en App Store. Inténtalo otra vez.')
          setAppStoreResults([])
        })
        .finally(() => setAppSearchLoading(false))
    }, 260)

    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [activeView, appSearchTerm])

  useEffect(() => {
    if (activeView !== 'form' || !formIsFinanced) return
    const term = financingProviderSearchTerm.trim()
    if (term.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setFinancingProviderSearchLoading(true)
      setFinancingProviderSearchError('')
      void fetchAppStoreResults(term, 20, controller.signal)
        .then((mapped) => setFinancingProviderResults(mapped))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setFinancingProviderSearchError('No se pudo buscar la financiera. Inténtalo otra vez.')
          setFinancingProviderResults([])
        })
        .finally(() => setFinancingProviderSearchLoading(false))
    }, 260)

    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [activeView, financingProviderSearchTerm, formIsFinanced])

  // ── Handlers ───────────────────────────────
  const openSubscriptionForm = useCallback((subscriptionId: string | null) => {
    setFormSaveError('')
    if (!subscriptionId) {
      setEditingId(null)
      setFormName('')
      setFormCategory(isGroupProfileActive ? 'Grupo' : 'General')
      setFormCustomLogoUrl('')
      setFormAmount(0)
      setFormIsFinanced(false)
      setFormFinancingProviderName('')
      setFormFinancingProviderLogoUrl('')
      setFinancingProviderSearchTerm('')
      setFinancingProviderResults([])
      setFinancingProviderSearchError('')
      if (isGroupProfileActive) {
        setGroupExpenseParticipantIds(selectedGroupMembers.map((m) => m.id))
        setGroupExpensePayerMemberId(selectedGroupMembers[0]?.id ?? '')
      }
      setAppSearchTerm('')
      setAppStoreResults([])
      setAppSearchError('')
      setFormIconKey('')
      setShowIconPicker(false)
      setGroupSplitMode('equal')
      setGroupCustomShares({})
      setFormEntryStep('choose')
      setIsManualEntry(false)
      setActiveView('form')
      return
    }

    const target = effectiveSubscriptions.find((item) => item.id === subscriptionId)
    setEditingId(subscriptionId)
    setFormName(target?.name ?? '')
    setFormCategory(target?.category ?? 'General')
    setFormCustomLogoUrl(target?.customLogoUrl ?? '')
    setFormAmount(target?.amount ?? 0)
    setFormIsFinanced(Boolean(target?.isFinanced))
    setFormFinancingProviderName(target?.financingProviderName ?? '')
    setFormFinancingProviderLogoUrl(target?.financingProviderLogoUrl ?? '')
    setFinancingProviderSearchTerm(target?.financingProviderName ?? '')
    setFinancingProviderResults([])
    setFinancingProviderSearchError('')
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormIconKey(target?.iconKey ?? '')

    if (!target) {
      setShowIconPicker(false)
      setActiveView('form')
      return
    }

    const key = normalizeAppKey(target.name)
    const visual = getSubscriptionVisual(target.name, target.category, target.status)
    const logoSrc = target.customLogoUrl || appLogoCache[key] || visual.logoSrc
    setShowIconPicker(!logoSrc)
    setFormEntryStep('details')
    setIsManualEntry(false)
    setActiveView('form')
  }, [appLogoCache, effectiveSubscriptions, isGroupProfileActive, selectedGroupMembers, setActiveView, setGroupExpenseParticipantIds, setGroupExpensePayerMemberId])

  const handleNameBlur = useCallback(async (rawName: string) => {
    const name = rawName.trim()
    if (!name) { setShowIconPicker(false); setFormIconKey(''); setFormCustomLogoUrl(''); return }
    if (formCustomLogoUrl) { setShowIconPicker(false); return }

    const cacheKey = normalizeAppKey(name)
    const cachedLogo = appLogoCache[cacheKey]
    if (cachedLogo) { setFormCustomLogoUrl(cachedLogo); setShowIconPicker(false); return }

    try {
      const results = await fetchAppStoreResults(name, 5)
      const bestMatch = pickBestAppMatch(name, results)
      if (bestMatch?.iconUrl) {
        setFormCustomLogoUrl(bestMatch.iconUrl)
        setFormCategory((c) => (c === 'General' ? bestMatch.category : c))
        setAppLogoCache((cur) => ({ ...cur, [cacheKey]: bestMatch.iconUrl }))
        setShowIconPicker(false)
        return
      }
    } catch { /* fallback */ }

    const visual = getSubscriptionVisual(name, '', 'activa')
    if (visual.logoSrc) { setShowIconPicker(false); setFormIconKey(''); return }
    setShowIconPicker(true)
  }, [appLogoCache, formCustomLogoUrl, setAppLogoCache])

  const handleSelectAppResult = useCallback((item: AppStoreResult) => {
    setFormName(item.name)
    setFormCategory(item.category || 'General')
    setFormCustomLogoUrl(item.iconUrl)
    setAppLogoCache((cur) => ({ ...cur, [normalizeAppKey(item.name)]: item.iconUrl }))
    setFormIconKey('')
    setShowIconPicker(false)
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormEntryStep('details')
    setIsManualEntry(false)
  }, [setAppLogoCache])

  const handleSelectFinancingProvider = useCallback((item: AppStoreResult) => {
    setFormFinancingProviderName(item.name)
    setFormFinancingProviderLogoUrl(item.iconUrl)
    setAppLogoCache((cur) => ({ ...cur, [normalizeAppKey(item.name)]: item.iconUrl }))
    setFinancingProviderSearchTerm(item.name)
    setFinancingProviderResults([])
    setFinancingProviderSearchError('')
  }, [setAppLogoCache])

  const handleToggleSubscriptionStatus = useCallback(async (id: string, currentStatus: Status) => {
    const nextStatus: Status = currentStatus === 'activa' ? 'cancelada' : 'activa'

    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('group_expenses').update({ is_active: nextStatus === 'activa' }).eq('id', id).eq('group_id', effectiveSelectedGroupId)
        if (!error) await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('subscriptions').update({ status: nextStatus }).eq('id', id).eq('user_id', userId)
        if (!error) await loadSubscriptions(userId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    setSubscriptions((cur) => cur.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
  }, [effectiveSelectedGroupId, isGroupProfileActive, loadGroupScopedSubscriptions, loadSubscriptions, setIsSyncing, setSubscriptions, userId])

  const handleSoftDeleteSubscription = useCallback(async (id: string) => {
    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('group_expenses').update({ anulado: 1 }).eq('id', id).eq('group_id', effectiveSelectedGroupId)
        if (!error) await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('subscriptions').update({ anulado: 1 }).eq('id', id).eq('user_id', userId)
        if (!error) await loadSubscriptions(userId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    setSubscriptions((cur) => cur.filter((item) => item.id !== id))
  }, [effectiveSelectedGroupId, isGroupProfileActive, loadGroupScopedSubscriptions, loadSubscriptions, setIsSyncing, setSubscriptions, userId])

  const handleSaveSubscription = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormSaveError('')
    setSubscriptionsNotice('')
    const form = new FormData(event.currentTarget)
    const normalizedName = formName.trim()
    if (!normalizedName) {
      setFormSaveError('Escribe un nombre para guardar la suscripción.')
      return
    }

    const payload: Omit<Subscription, 'id' | 'createdAt'> = {
      name: normalizedName,
      amount: Number(form.get('amount') ?? 0),
      frequency: String(form.get('frequency')) as Frequency,
      nextChargeDate: String(form.get('nextChargeDate') ?? ''),
      paymentEndDate: String(form.get('paymentEndDate') ?? '').trim() || null,
      iconKey: String(form.get('iconKey') ?? '').trim() || null,
      customLogoUrl: formCustomLogoUrl.trim() || null,
      isFinanced: formIsFinanced,
      financingProviderName: formIsFinanced ? formFinancingProviderName.trim() || null : null,
      financingProviderLogoUrl: formIsFinanced ? formFinancingProviderLogoUrl.trim() || null : null,
      category: formCategory.trim() || 'General',
      reminderDays: Number(form.get('reminderDays')) as Reminder,
      reminderTime: String(form.get('reminderTime') || '09:00'),
      status: String(form.get('status')) as Status,
      anulado: 0,
    }
    const previousSubscription = editingId && !isGroupProfileActive
      ? subscriptions.find((item) => item.id === editingId) ?? null
      : null

    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)
      try {
        if (editingId) {
          const { error } = await supabase
            .from('group_expenses')
            .update({
              name: payload.name, amount: payload.amount,
              frequency: payload.frequency, next_charge_date: payload.nextChargeDate,
              payment_end_date: payload.paymentEndDate,
              is_financed: payload.isFinanced,
              financing_provider_name: payload.financingProviderName,
              financing_provider_logo_url: payload.financingProviderLogoUrl,
              is_active: payload.status === 'activa',
            })
            .eq('id', editingId)
            .eq('group_id', effectiveSelectedGroupId)
          if (error) {
            setFormSaveError(getSaveErrorMessage(error.message))
            return
          }
          if (!error) {
            await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
            await loadGroupMonthBalances(effectiveSelectedGroupId)
          }
        } else {
          const payerMemberId = groupExpensePayerMemberId || selectedGroupMembers[0]?.id || ''
          const participantIds = groupExpenseParticipantIds.length > 0 ? [...new Set(groupExpenseParticipantIds)] : selectedGroupMembers.map((m) => m.id)
          if (!payerMemberId || participantIds.length === 0) {
            setGroupsError('El grupo necesita miembros activos para crear gastos.')
            setActiveView('dashboard')
            return
          }

          const { data: expenseInserted, error: expenseError } = await supabase
            .from('group_expenses')
            .insert({
              group_id: effectiveSelectedGroupId, name: payload.name, amount: payload.amount,
              frequency: payload.frequency, next_charge_date: payload.nextChargeDate,
              payment_end_date: payload.paymentEndDate,
              is_financed: payload.isFinanced,
              financing_provider_name: payload.financingProviderName,
              financing_provider_logo_url: payload.financingProviderLogoUrl,
              payer_member_id: payerMemberId, is_active: payload.status === 'activa',
              created_by_user_id: userId,
            })
            .select('id')
            .single()

          if (expenseError || !expenseInserted) {
            setFormSaveError(getSaveErrorMessage(expenseError?.message))
            return
          }

          if (expenseInserted) {
            const isCustom = groupSplitMode === 'custom'
            const participantsPayload = participantIds.map((memberId) => ({
              expense_id: expenseInserted.id, member_id: memberId,
              share_type: isCustom ? 'fixed' as const : 'equal' as const,
              ...(isCustom ? { share_value: groupCustomShares[memberId] ?? 0 } : {}),
            }))
            const { error: participantsError } = await supabase.from('group_expense_participants').insert(participantsPayload)

            if (participantsError) {
              setFormSaveError(getSaveErrorMessage(participantsError.message))
              return
            }

            if (!participantsError) {
              const { data: chargeInserted, error: chargeError } = await supabase
                .from('expense_charge_instances')
                .insert({
                  expense_id: expenseInserted.id, charge_date: payload.nextChargeDate,
                  amount_total: payload.amount, payer_member_id: payerMemberId, status: 'pending',
                })
                .select('id')
                .single()

              if (chargeError || !chargeInserted) {
                setFormSaveError(getSaveErrorMessage(chargeError?.message))
                return
              }

              if (!chargeError && chargeInserted) {
                const splits = isCustom
                  ? participantIds.map((id) => groupCustomShares[id] ?? 0)
                  : equalSplit(payload.amount, participantIds.length)
                const sharesPayload = participantIds.map((memberId, i) => ({
                  charge_instance_id: chargeInserted.id, member_id: memberId, owed_amount: splits[i],
                }))
                const { error: sharesError } = await supabase.from('expense_charge_shares').insert(sharesPayload)
                if (sharesError) {
                  setFormSaveError(getSaveErrorMessage(sharesError.message))
                  return
                }
                if (!sharesError) {
                  await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
                  await loadGroupMonthBalances(effectiveSelectedGroupId)
                }
              }
            }
          }
        }
      } catch (error) {
        setFormSaveError(getSaveErrorMessage(error instanceof Error ? error.message : undefined))
        return
      } finally {
        setIsSyncing(false)
      }
    } else if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      try {
        if (editingId) {
          const { error } = await supabase
            .from('subscriptions')
            .update(toSupabaseSubscriptionPayload(payload))
            .eq('id', editingId)
            .eq('user_id', userId)
          if (error) {
            setFormSaveError(getSaveErrorMessage(error.message))
            return
          }
          await loadSubscriptions(userId)
        } else {
          const { error } = await supabase.from('subscriptions').insert(toSupabaseSubscriptionInsert(payload, userId))
          if (error) {
            setFormSaveError(getSaveErrorMessage(error.message))
            return
          }
          await loadSubscriptions(userId)
        }
      } catch (error) {
        setFormSaveError(getSaveErrorMessage(error instanceof Error ? error.message : undefined))
        return
      } finally {
        setIsSyncing(false)
      }
    } else {
      if (editingId) {
        setSubscriptions((cur) => cur.map((item) => (item.id === editingId ? { ...item, ...payload } : item)))
      } else {
        const id = self.crypto?.randomUUID?.() ?? `local-${Date.now()}`
        setSubscriptions((cur) => [...cur, { id, createdAt: new Date().toISOString(), ...payload }])
      }
    }

    setEditingId(null)
    setFormName('')
    setFormCategory('General')
    setFormCustomLogoUrl('')
    setFormIsFinanced(false)
    setFormFinancingProviderName('')
    setFormFinancingProviderLogoUrl('')
    setFinancingProviderSearchTerm('')
    setFinancingProviderResults([])
    setFinancingProviderSearchError('')
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormIconKey('')
    setShowIconPicker(false)
    setFormEntryStep('choose')
    setIsManualEntry(false)
    if (previousSubscription) {
      const changeId = self.crypto?.randomUUID?.() ?? `price-${Date.now()}`
      const change = createPriceChange(previousSubscription, payload.amount, changeId, new Date().toISOString())
      setPriceHistory((current) => appendPriceChange(current, change))
    }
    setSubscriptionsNotice(editingId ? 'Suscripción actualizada correctamente.' : 'Suscripción guardada correctamente.')
    setActiveView('subscriptions')
  }, [
    editingId, effectiveSelectedGroupId, formCategory, formCustomLogoUrl,
    formFinancingProviderLogoUrl, formFinancingProviderName, formIsFinanced, formName,
    groupCustomShares, groupExpenseParticipantIds, groupExpensePayerMemberId, groupSplitMode, isGroupProfileActive,
    loadGroupMonthBalances, loadGroupScopedSubscriptions, loadSubscriptions,
    selectedGroupMembers, setActiveView, setGroupsError, setIsSyncing, setPriceHistory, setSubscriptions, subscriptions, userId,
  ])

  const handleExport = useCallback((format: 'json' | 'csv') => {
    const payload = buildSubscriptionsExportPayload(effectiveSubscriptions, format)

    const blob = new Blob([payload], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = format === 'json' ? 'suscripciones.json' : 'suscripciones.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [effectiveSubscriptions])

  const handleImportFile = useCallback(async (file: File) => {
    setImportStatus('')
    setImportError('')
    setSubscriptionsNotice('')

    try {
      const rawText = await file.text()
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
      const parsed = isCsv ? parseExportedSubscriptionsCsv(rawText) : JSON.parse(rawText) as unknown
      if (!Array.isArray(parsed)) {
        setImportError('El archivo debe contener una lista de suscripciones.')
        return
      }

      const nowIso = new Date().toISOString()
      const imported = parsed
        .map((item, index) => normalizeImportedSubscription(
          item,
          self.crypto?.randomUUID?.() ?? `imported-${Date.now()}-${index}`,
          nowIso,
        ))
        .filter((item): item is Subscription => Boolean(item))

      if (imported.length === 0) {
        setImportError('No se encontraron suscripciones válidas en el archivo.')
        return
      }

      if (hasSupabase && supabase && userId) {
        setIsSyncing(true)
        try {
          const { error } = await supabase
            .from('subscriptions')
            .insert(imported.map((item) => toSupabaseImportedSubscriptionInsert(item, userId)))
          if (error) {
            setImportError(getImportErrorMessage(error.message))
            return
          }
          await loadSubscriptions(userId)
        } finally {
          setIsSyncing(false)
        }
      } else {
        setSubscriptions((current) => [...current, ...imported])
      }

      const skipped = parsed.length - imported.length
      const suffix = skipped > 0 ? ` (${skipped} omitidas por formato inválido)` : ''
      setImportStatus(`${imported.length} suscripciones importadas.${suffix}`)
      setSubscriptionsNotice(`${imported.length} suscripciones importadas correctamente.`)
    } catch (error) {
      setImportError(getImportErrorMessage(error instanceof Error ? error.message : undefined))
    }
  }, [loadSubscriptions, setIsSyncing, setSubscriptions, userId])

  return {
    subscriptions, setSubscriptions, loadSubscriptions,
    priceHistory,
    // Form
    editingId, editingSubscription,
    formName, setFormName, formCategory, setFormCategory,
    formCustomLogoUrl, setFormCustomLogoUrl, formAmount, setFormAmount,
    formIconKey, setFormIconKey, formIsFinanced, setFormIsFinanced,
    formFinancingProviderName, setFormFinancingProviderName,
    formFinancingProviderLogoUrl, setFormFinancingProviderLogoUrl,
    financingProviderSearchTerm, setFinancingProviderSearchTerm,
    financingProviderResults, financingProviderSearchLoading, financingProviderSearchError,
    formSaveError,
    showIconPicker,
    appSearchTerm, setAppSearchTerm, appStoreResults, appSearchLoading, appSearchError,
    formEntryStep, setFormEntryStep, isManualEntry, setIsManualEntry,
    groupSplitMode, setGroupSplitMode, groupCustomShares, setGroupCustomShares,
    // Filters
    searchTerm, setSearchTerm, subscriptionFilter, setSubscriptionFilter,
    chargeOrder, setChargeOrder, frequencyFilter, setFrequencyFilter,
    excludedCategories, setExcludedCategories, categorySearchTerm, setCategorySearchTerm,
    showAdvancedFilters, setShowAdvancedFilters,
    availableCategories, visibleCategoryOptions, activeFilterCount,
    visibleSubscriptions,
    subscriptionsNotice,
    importStatus, importError,
    // Computed
    scopedSubscriptions, activeSubscriptions, effectiveSubscriptions,
    personalMonthTotal, groupOnlyMonthTotal, combinedMonthTotal,
    groupOnlyYearTotal, personalYearTotal,
    upcomingCharges, todayCharges, upcoming30,
    categoryBreakdown, topExpensive, monthlyProjection, spendingHistory,
    // Handlers
    openSubscriptionForm, handleNameBlur, handleSelectAppResult, handleSelectFinancingProvider,
    handleToggleSubscriptionStatus, handleSoftDeleteSubscription, handleSaveSubscription, handleExport,
    handleImportFile,
  }
}
