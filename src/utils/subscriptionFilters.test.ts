import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  getActiveFilterCount,
  getAvailableCategories,
  getVisibleCategoryOptions,
  getVisibleSubscriptions,
} from './subscriptionFilters'

const makeSubscription = (overrides: Partial<Subscription>): Subscription => ({
  id: 'sub-1',
  name: 'Netflix',
  amount: 10,
  frequency: 'mensual',
  nextChargeDate: '2026-01-01',
  paymentEndDate: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  category: 'Entretenimiento',
  reminderDays: 3,
  reminderTime: '09:00',
  status: 'activa',
  anulado: 0,
  ...overrides,
})

describe('subscription filters', () => {
  it('builds unique sorted category options', () => {
    expect(getAvailableCategories([
      makeSubscription({ category: 'Música' }),
      makeSubscription({ id: 'sub-2', category: 'Entretenimiento' }),
      makeSubscription({ id: 'sub-3', category: 'Música' }),
    ])).toEqual(['Entretenimiento', 'Música'])
  })

  it('filters category options by search term', () => {
    expect(getVisibleCategoryOptions(['Casa', 'Entretenimiento'], 'cas')).toEqual(['Casa'])
  })

  it('counts active advanced filters', () => {
    expect(getActiveFilterCount({ chargeOrder: 'desc', frequencyFilter: 'mensual', excludedCategories: ['Casa'] })).toBe(3)
    expect(getActiveFilterCount({ chargeOrder: 'asc', frequencyFilter: 'all', excludedCategories: [] })).toBe(0)
  })

  it('filters visible subscriptions by status, frequency, category and search', () => {
    const subscriptions = [
      makeSubscription({ id: 'sub-1', name: 'Netflix', category: 'Entretenimiento', frequency: 'mensual', status: 'activa' }),
      makeSubscription({ id: 'sub-2', name: 'Spotify', category: 'Música', frequency: 'mensual', status: 'activa' }),
      makeSubscription({ id: 'sub-3', name: 'Seguro', category: 'Casa', frequency: 'anual', status: 'cancelada' }),
    ]

    expect(getVisibleSubscriptions(subscriptions, {
      subscriptionFilter: 'activa',
      frequencyFilter: 'mensual',
      excludedCategories: ['Música'],
      searchTerm: 'net',
      chargeOrder: 'asc',
    }).map((item) => item.id)).toEqual(['sub-1'])
  })

  it('sorts by date and then name', () => {
    const subscriptions = [
      makeSubscription({ id: 'sub-2', name: 'Spotify', nextChargeDate: '2026-01-01' }),
      makeSubscription({ id: 'sub-1', name: 'Apple', nextChargeDate: '2026-01-01' }),
      makeSubscription({ id: 'sub-3', name: 'Netflix', nextChargeDate: '2026-02-01' }),
    ]

    expect(getVisibleSubscriptions(subscriptions, {
      subscriptionFilter: 'all',
      frequencyFilter: 'all',
      excludedCategories: [],
      searchTerm: '',
      chargeOrder: 'asc',
    }).map((item) => item.name)).toEqual(['Apple', 'Spotify', 'Netflix'])
  })
})
