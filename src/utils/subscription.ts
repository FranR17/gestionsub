import type { AppStoreResult, Reminder, Status, Subscription, SupabaseSubscriptionRow } from '../types'
import { diffInDays, nextCycleDate, previousCycleDate, toIsoDate, toLocalNoonDate } from './date'

export const normalizeReminder = (value: number): Reminder => {
  const n = Math.round(value)
  if (n >= 0 && n <= 30) return n
  return 3
}

export const toChargePaymentKey = (subscriptionId: string, isoDate: string) =>
  `${subscriptionId}__${isoDate}`

export type SubscriptionCharge = {
  subscription: Subscription
  isoDate: string
  chargeDate: Date
}

export const equalSplit = (amount: number, count: number) => {
  if (count <= 0) {
    return []
  }

  const cents = Math.round(amount * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count

  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100)
}

export const fromSupabaseRow = (row: SupabaseSubscriptionRow): Subscription => ({
  id: row.id,
  name: row.name,
  amount: Number(row.amount),
  frequency: row.frequency,
  nextChargeDate: row.next_charge_date,
  paymentEndDate: row.payment_end_date ?? null,
  createdAt: row.created_at,
  category: row.category,
  reminderDays: normalizeReminder(row.reminder_days),
  reminderTime: row.reminder_time ?? '09:00',
  status: row.status,
  iconKey: row.icon_key ?? null,
  customLogoUrl: row.custom_logo_url ?? null,
  isFinanced: Boolean(row.is_financed),
  financingProviderName: row.financing_provider_name ?? null,
  financingProviderLogoUrl: row.financing_provider_logo_url ?? null,
  anulado: (row.anulado === 1 ? 1 : 0) as 0 | 1,
})

export const isChargeWithinPaymentEndDate = (subscription: Subscription, chargeDate: Date) => {
  if (!subscription.paymentEndDate) return true
  const endDate = toLocalNoonDate(subscription.paymentEndDate)
  if (Number.isNaN(endDate.getTime())) return true
  return chargeDate <= endDate
}

export const getSubscriptionChargesForPeriod = (
  items: Subscription[],
  periodStart: Date,
  periodEndExclusive: Date,
  options: { includeInactive?: boolean } = {},
): SubscriptionCharge[] => {
  const charges: SubscriptionCharge[] = []

  items.forEach((subscription) => {
    if (!options.includeInactive && subscription.status !== 'activa') return

    let chargeDate = toLocalNoonDate(subscription.nextChargeDate)
    const createdAt = new Date(subscription.createdAt)
    const createdDate = Number.isNaN(createdAt.getTime()) ? periodStart : createdAt
    let guard = 0

    while (chargeDate >= periodEndExclusive && guard < 360) {
      chargeDate = toLocalNoonDate(previousCycleDate(toIsoDate(chargeDate), subscription.frequency))
      guard += 1
    }

    while (chargeDate < periodStart && guard < 720) {
      chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), subscription.frequency))
      guard += 1
    }

    while (chargeDate < periodEndExclusive && guard < 1080) {
      if (chargeDate >= periodStart && chargeDate >= createdDate && isChargeWithinPaymentEndDate(subscription, chargeDate)) {
        charges.push({
          subscription,
          isoDate: toIsoDate(chargeDate),
          chargeDate: new Date(chargeDate),
        })
      }
      chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), subscription.frequency))
      guard += 1
    }
  })

  return charges
}

export const normalizeAppKey = (value: string) => value.trim().toLowerCase()

export const fetchAppStoreResults = async (
  term: string,
  limit: number,
  signal?: AbortSignal,
): Promise<AppStoreResult[]> => {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=es&limit=${limit}`,
    signal ? { signal } : undefined,
  )

  if (!response.ok) {
    throw new Error('No se pudo consultar App Store')
  }

  const data = (await response.json()) as {
    results?: Array<{
      trackId: number
      trackName: string
      artworkUrl100?: string
      primaryGenreName?: string
    }>
  }

  return (data.results ?? []).map((item) => ({
    id: item.trackId,
    name: item.trackName,
    iconUrl: String(item.artworkUrl100 ?? '').replace('100x100bb', '512x512bb'),
    category: item.primaryGenreName ?? 'General',
  }))
}

export const pickBestAppMatch = (term: string, results: AppStoreResult[]) => {
  if (results.length === 0) {
    return null
  }

  const normalizedTerm = normalizeAppKey(term)
  const exact = results.find((item) => normalizeAppKey(item.name) === normalizedTerm)
  return exact ?? results[0]
}

export const getNextChargeCountdown = (nextChargeDate: string, status: Status) => {
  if (status === 'cancelada') {
    return 'cancelada'
  }

  const days = diffInDays(new Date(), toLocalNoonDate(nextChargeDate))

  if (days <= 0) {
    return 'hoy'
  }

  if (days === 1) {
    return '1 día'
  }

  if (days < 7) {
    return `${days} días`
  }

  const weeks = Math.ceil(days / 7)
  return weeks === 1 ? '1 semana' : `${weeks} semanas`
}

export const calculatePeriodTotal = (items: Subscription[], periodStart: Date, periodEndExclusive: Date) => {
  return getSubscriptionChargesForPeriod(items, periodStart, periodEndExclusive)
    .reduce((total, charge) => total + charge.subscription.amount, 0)
}
