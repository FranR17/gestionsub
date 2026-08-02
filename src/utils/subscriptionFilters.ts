import type { ChargeOrder, Frequency, Subscription, SubscriptionFilter } from '../types'

export type SubscriptionFilterState = {
  subscriptionFilter: SubscriptionFilter
  frequencyFilter: Frequency | 'all'
  excludedCategories: string[]
  searchTerm: string
  chargeOrder: ChargeOrder
}

export const getAvailableCategories = (subscriptions: Subscription[]) => {
  const categories = subscriptions.map((item) => item.category.trim() || 'General')
  return [...new Set(categories)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export const getVisibleCategoryOptions = (categories: string[], searchTerm: string) => {
  const normalized = searchTerm.trim().toLowerCase()
  if (!normalized) return categories
  return categories.filter((category) => category.toLowerCase().includes(normalized))
}

export const getActiveFilterCount = (state: Pick<SubscriptionFilterState, 'chargeOrder' | 'frequencyFilter' | 'excludedCategories'>) =>
  (state.chargeOrder === 'desc' ? 1 : 0) +
  (state.frequencyFilter !== 'all' ? 1 : 0) +
  (state.excludedCategories.length > 0 ? 1 : 0)

export const getVisibleSubscriptions = (subscriptions: Subscription[], state: SubscriptionFilterState) => {
  const normalizedSearch = state.searchTerm.trim().toLowerCase()

  return [...subscriptions]
    .filter((item) => (state.subscriptionFilter === 'all' ? true : item.status === state.subscriptionFilter))
    .filter((item) => (state.frequencyFilter === 'all' ? true : item.frequency === state.frequencyFilter))
    .filter((item) => !state.excludedCategories.includes(item.category.trim() || 'General'))
    .filter((item) => {
      if (!normalizedSearch) return true
      return item.name.toLowerCase().includes(normalizedSearch)
        || item.category.toLowerCase().includes(normalizedSearch)
        || item.frequency.toLowerCase().includes(normalizedSearch)
        || (item.financingProviderName ?? '').toLowerCase().includes(normalizedSearch)
    })
    .sort((a, b) => {
      const byDate = state.chargeOrder === 'asc'
        ? a.nextChargeDate.localeCompare(b.nextChargeDate)
        : b.nextChargeDate.localeCompare(a.nextChargeDate)
      return byDate !== 0 ? byDate : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    })
}
