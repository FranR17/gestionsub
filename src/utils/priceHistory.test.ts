import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { appendPriceChange, createPriceChange } from './priceHistory'

const subscription: Subscription = {
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
}

describe('price history helpers', () => {
  it('ignores amount changes smaller than one cent', () => {
    expect(createPriceChange(subscription, 10.004, 'change-1', '2026-01-02T12:00:00.000Z')).toBeNull()
  })

  it('creates a price change when the amount changes', () => {
    expect(createPriceChange(subscription, 12.5, 'change-1', '2026-01-02T12:00:00.000Z')).toEqual({
      id: 'change-1',
      subscriptionId: 'sub-1',
      subscriptionName: 'Netflix',
      previousAmount: 10,
      nextAmount: 12.5,
      changedAt: '2026-01-02T12:00:00.000Z',
    })
  })

  it('prepends and limits price history', () => {
    const first = createPriceChange(subscription, 11, 'change-1', '2026-01-02T12:00:00.000Z')
    const second = createPriceChange(subscription, 12, 'change-2', '2026-01-03T12:00:00.000Z')

    expect(appendPriceChange(appendPriceChange([], first), second, 1)).toEqual([second])
  })
})
