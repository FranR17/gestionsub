import type { GroupBalance, GroupMember, GroupSplitMode, SettlementTransfer, Subscription } from '../types'
import { equalSplit, getSubscriptionChargesForPeriod } from './subscription'

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const getCustomShareTotal = (participantIds: string[], customShares: Record<string, number>) =>
  roundMoney(participantIds.reduce((total, memberId) => total + Math.max(0, Number(customShares[memberId] ?? 0)), 0))

export const getGroupChargeShares = (
  amount: number,
  participantIds: string[],
  splitMode: GroupSplitMode,
  customShares: Record<string, number> = {},
) => {
  if (participantIds.length === 0) return []
  if (splitMode === 'custom') {
    return participantIds.map((memberId) => roundMoney(Math.max(0, Number(customShares[memberId] ?? 0))))
  }
  return equalSplit(amount, participantIds.length)
}

export const getCustomSharesError = (
  amount: number,
  participantIds: string[],
  customShares: Record<string, number>,
) => {
  if (participantIds.length === 0) return 'Selecciona al menos un participante.'
  const total = getCustomShareTotal(participantIds, customShares)
  if (Math.abs(total - roundMoney(amount)) > 0.009) {
    return `El reparto personalizado suma ${total.toFixed(2)} y debe sumar ${roundMoney(amount).toFixed(2)}.`
  }
  return ''
}

export const calculateLocalGroupBalances = (
  members: GroupMember[],
  subscriptions: Subscription[],
  now = new Date(),
): GroupBalance[] => {
  const activeMembers = members.filter((member) => member.status === 'active')
  const memberById = new Map(activeMembers.map((member) => [member.id, member]))
  const balances = new Map<string, GroupBalance>()

  activeMembers.forEach((member) => {
    balances.set(member.id, {
      member_id: member.id,
      member_name: member.displayName,
      paid_total: 0,
      owed_total: 0,
      net_total: 0,
    })
  })

  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)

  getSubscriptionChargesForPeriod(subscriptions, start, endExclusive).forEach(({ subscription }) => {
    const rawParticipants = subscription.groupParticipantIds?.length
      ? subscription.groupParticipantIds
      : activeMembers.map((member) => member.id)
    const participantIds = rawParticipants.filter((memberId) => memberById.has(memberId))
    if (participantIds.length === 0) return

    const payerId = subscription.groupPayerMemberId && memberById.has(subscription.groupPayerMemberId)
      ? subscription.groupPayerMemberId
      : participantIds[0]
    const payerBalance = balances.get(payerId)
    if (payerBalance) payerBalance.paid_total = roundMoney(payerBalance.paid_total + subscription.amount)

    const splitMode: GroupSplitMode = subscription.groupShares ? 'custom' : 'equal'
    const shares = getGroupChargeShares(subscription.amount, participantIds, splitMode, subscription.groupShares ?? {})
    participantIds.forEach((memberId, index) => {
      const balance = balances.get(memberId)
      if (!balance) return
      balance.owed_total = roundMoney(balance.owed_total + (shares[index] ?? 0))
    })
  })

  return [...balances.values()]
    .map((balance) => ({
      ...balance,
      paid_total: roundMoney(balance.paid_total),
      owed_total: roundMoney(balance.owed_total),
      net_total: roundMoney(balance.paid_total - balance.owed_total),
    }))
    .sort((a, b) => b.net_total - a.net_total || a.member_name.localeCompare(b.member_name, 'es', { sensitivity: 'base' }))
}

export const computeSettlementTransfers = (balances: GroupBalance[]): SettlementTransfer[] => {
  const debtors = balances
    .filter((balance) => balance.net_total < -0.009)
    .map((balance) => ({ id: balance.member_id, name: balance.member_name, amount: roundMoney(Math.abs(balance.net_total)) }))
    .sort((a, b) => b.amount - a.amount)

  const creditors = balances
    .filter((balance) => balance.net_total > 0.009)
    .map((balance) => ({ id: balance.member_id, name: balance.member_name, amount: roundMoney(balance.net_total) }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: SettlementTransfer[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = roundMoney(Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount))
    if (amount > 0.009) {
      transfers.push({
        from_member_id: debtors[debtorIndex].id,
        from_name: debtors[debtorIndex].name,
        to_member_id: creditors[creditorIndex].id,
        to_name: creditors[creditorIndex].name,
        amount,
      })
    }

    debtors[debtorIndex].amount = roundMoney(debtors[debtorIndex].amount - amount)
    creditors[creditorIndex].amount = roundMoney(creditors[creditorIndex].amount - amount)
    if (debtors[debtorIndex].amount < 0.01) debtorIndex += 1
    if (creditors[creditorIndex].amount < 0.01) creditorIndex += 1
  }

  return transfers
}
