import { describe, expect, it } from 'vitest'
import type { GroupMember, Subscription } from '../types'
import {
  calculateLocalGroupBalances,
  computeSettlementTransfers,
  getCustomSharesError,
  getGroupChargeShares,
} from './groups'

const members: GroupMember[] = [
  { id: 'm1', groupId: 'g1', userId: 'u1', role: 'owner', status: 'active', displayName: 'Fran' },
  { id: 'm2', groupId: 'g1', userId: 'u2', role: 'member', status: 'active', displayName: 'Ana' },
  { id: 'm3', groupId: 'g1', userId: 'u3', role: 'member', status: 'active', displayName: 'Luis' },
]

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'expense-1',
  name: 'Internet',
  amount: 60,
  frequency: 'mensual',
  nextChargeDate: '2026-08-10',
  createdAt: '2026-08-01T12:00:00.000Z',
  category: 'Grupo',
  reminderDays: 3,
  reminderTime: '09:00',
  status: 'activa',
  anulado: 0,
  groupId: 'g1',
  groupPayerMemberId: 'm1',
  groupParticipantIds: ['m1', 'm2', 'm3'],
  ...overrides,
})

describe('group utilities', () => {
  it('splits group charges equally or with custom amounts', () => {
    expect(getGroupChargeShares(10, ['m1', 'm2', 'm3'], 'equal')).toEqual([3.34, 3.33, 3.33])
    expect(getGroupChargeShares(10, ['m1', 'm2'], 'custom', { m1: 4, m2: 6 })).toEqual([4, 6])
  })

  it('validates custom share totals', () => {
    expect(getCustomSharesError(10, ['m1', 'm2'], { m1: 4, m2: 6 })).toBe('')
    expect(getCustomSharesError(10, ['m1', 'm2'], { m1: 4, m2: 5 })).toContain('debe sumar 10.00')
  })

  it('calculates local balances for equal splits', () => {
    const balances = calculateLocalGroupBalances(members, [subscription()], new Date('2026-08-20T12:00:00'))

    expect(balances).toEqual([
      { member_id: 'm1', member_name: 'Fran', paid_total: 60, owed_total: 20, net_total: 40 },
      { member_id: 'm2', member_name: 'Ana', paid_total: 0, owed_total: 20, net_total: -20 },
      { member_id: 'm3', member_name: 'Luis', paid_total: 0, owed_total: 20, net_total: -20 },
    ])
  })

  it('calculates transfers from local balances', () => {
    const balances = calculateLocalGroupBalances(
      members,
      [subscription({ groupShares: { m1: 10, m2: 20, m3: 30 } })],
      new Date('2026-08-20T12:00:00'),
    )

    expect(computeSettlementTransfers(balances)).toEqual([
      { from_member_id: 'm3', from_name: 'Luis', to_member_id: 'm1', to_name: 'Fran', amount: 30 },
      { from_member_id: 'm2', from_name: 'Ana', to_member_id: 'm1', to_name: 'Fran', amount: 20 },
    ])
  })
})
