import type { PriceChange, Subscription } from '../types'

const toCents = (amount: number) => Math.round(amount * 100)

export const createPriceChange = (
  subscription: Subscription,
  nextAmount: number,
  id: string,
  changedAt: string,
): PriceChange | null => {
  if (toCents(subscription.amount) === toCents(nextAmount)) return null

  return {
    id,
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    previousAmount: Math.round(subscription.amount * 100) / 100,
    nextAmount: Math.round(nextAmount * 100) / 100,
    changedAt,
  }
}

export const appendPriceChange = (
  history: PriceChange[],
  change: PriceChange | null,
  limit = 50,
) => {
  if (!change) return history
  return [change, ...history].slice(0, limit)
}
