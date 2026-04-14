import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Frequency,
  Group,
  GroupBalance,
  GroupExpenseRow,
  GroupInvite,
  GroupMember,
  Reminder,
  Subscription,
  Status,
} from '../types'
import { storageKeys } from '../constants'
import { usePersistedState } from './usePersistedState'

export function useGroups(defaultReminder: Reminder) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMembersByGroup, setGroupMembersByGroup] = useState<Record<string, GroupMember[]>>({})
  const [incomingInvites, setIncomingInvites] = useState<GroupInvite[]>([])
  const [inviteGroups, setInviteGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([])
  const [, setGroupMonthTotal] = useState(0)
  const [, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState('')
  const [groupsSuccess, setGroupsSuccess] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteEmailInput, setInviteEmailInput] = useState('')
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteModalGroupName, setInviteModalGroupName] = useState('')
  const [inviteModalLoading, setInviteModalLoading] = useState(false)
  const [groupExpensePayerMemberId, setGroupExpensePayerMemberId] = useState('')
  const [groupExpenseParticipantIds, setGroupExpenseParticipantIds] = useState<string[]>([])
  const [groupScopedSubscriptions, setGroupScopedSubscriptions] = useState<Subscription[]>([])
  const [activeProfileContext, setActiveProfileContext] = usePersistedState(storageKeys.profileContext, 'personal')

  const [pendingInviteToken, setPendingInviteToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('invite')
    if (urlToken) {
      sessionStorage.setItem('gestionsub.pendingInvite', urlToken)
      window.history.replaceState({}, '', window.location.pathname)
      return urlToken
    }
    return sessionStorage.getItem('gestionsub.pendingInvite') ?? ''
  })

  // Derived profile state
  const profileGroupCandidateId = activeProfileContext.startsWith('group:')
    ? activeProfileContext.slice('group:'.length)
    : ''
  const isGroupProfileActive =
    profileGroupCandidateId.length > 0 && groups.some((g) => g.id === profileGroupCandidateId)
  const groupProfileId = isGroupProfileActive ? profileGroupCandidateId : ''
  const effectiveSelectedGroupId = isGroupProfileActive ? groupProfileId : selectedGroupId

  const activeProfileLabel = useMemo(() => {
    if (!isGroupProfileActive) return 'Personal'
    return groups.find((g) => g.id === groupProfileId)?.name ?? 'Grupo'
  }, [groupProfileId, groups, isGroupProfileActive])

  const selectedGroupMembers = useMemo(
    () => groupMembersByGroup[effectiveSelectedGroupId] ?? [],
    [effectiveSelectedGroupId, groupMembersByGroup],
  )

  const groupReceivables = useMemo(
    () => groupBalances.filter((item) => item.net_total > 0.009),
    [groupBalances],
  )

  const groupDebts = useMemo(
    () => groupBalances.filter((item) => item.net_total < -0.009),
    [groupBalances],
  )

  // ── Data loaders ────────────────────────────
  const loadGroupMonthBalances = useCallback(async (groupId: string) => {
    if (!supabase || !groupId) {
      setGroupBalances([])
      setGroupMonthTotal(0)
      return
    }

    const now = new Date()
    const { data, error } = await supabase.rpc('get_group_monthly_balances', {
      p_group_id: groupId,
      p_year: now.getFullYear(),
      p_month: now.getMonth() + 1,
    })

    if (error || !data) {
      setGroupBalances([])
      setGroupMonthTotal(0)
      return
    }

    const balances = (data as GroupBalance[]).map((item) => ({
      ...item,
      paid_total: Number(item.paid_total),
      owed_total: Number(item.owed_total),
      net_total: Number(item.net_total),
    }))
    setGroupBalances(balances)
    setGroupMonthTotal(balances.reduce((t, i) => t + Math.max(0, i.paid_total), 0))
  }, [])

  const loadGroupScopedSubscriptions = useCallback(async (groupId: string) => {
    if (!supabase || !groupId) {
      setGroupScopedSubscriptions([])
      return
    }

    const { data, error } = await supabase
      .from('group_expenses')
      .select('id,name,amount,frequency,next_charge_date,created_at,is_active')
      .eq('group_id', groupId)
      .order('next_charge_date', { ascending: true })

    if (error) {
      setGroupScopedSubscriptions([])
      return
    }

    setGroupScopedSubscriptions(
      (data as GroupExpenseRow[]).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        amount: Number(row.amount),
        frequency: (row.frequency === 'puntual' ? 'mensual' : row.frequency) as Frequency,
        nextChargeDate: String(row.next_charge_date),
        createdAt: String(row.created_at),
        iconKey: null,
        customLogoUrl: null,
        category: 'Grupo',
        reminderDays: defaultReminder,
        reminderTime: '09:00',
        status: (row.is_active ? 'activa' : 'cancelada') as Status,
        anulado: 0 as const,
      })),
    )
  }, [defaultReminder])

  const loadGroupsContext = useCallback(async (uid: string, userEmail: string) => {
    if (!supabase) return

    setGroupsLoading(true)
    setGroupsError('')

    const { data: memberships, error: membershipsError } = await supabase
      .from('group_members')
      .select('id,group_id,user_id,role,status')
      .eq('user_id', uid)
      .eq('status', 'active')

    if (membershipsError) {
      setGroupsLoading(false)
      setGroupsError('No se pudieron cargar tus grupos.')
      return
    }

    const groupIds = [...new Set((memberships ?? []).map((i) => String(i.group_id)))]

    const { data: invitesData } = await supabase
      .from('group_invites')
      .select('id,group_id,invitee_email,status,expires_at')
      .eq('status', 'pending')
      .ilike('invitee_email', userEmail)

    setIncomingInvites(
      (invitesData ?? []).map((inv) => ({
        id: String(inv.id),
        groupId: String(inv.group_id),
        inviteeEmail: String(inv.invitee_email),
        status: inv.status as GroupInvite['status'],
        expiresAt: String(inv.expires_at),
      })),
    )

    if (groupIds.length === 0) {
      setGroups([])
      setGroupMembersByGroup({})
      setSelectedGroupId('')
      setGroupBalances([])
      setGroupMonthTotal(0)

      const pendingIds = (invitesData ?? []).map((i) => String(i.group_id))
      if (pendingIds.length > 0) {
        const { data: igData } = await supabase
          .from('groups')
          .select('id,name,owner_user_id,created_at')
          .in('id', pendingIds)
        setInviteGroups(
          (igData ?? []).map((g) => ({
            id: String(g.id), name: String(g.name),
            ownerUserId: String(g.owner_user_id), createdAt: String(g.created_at),
          })),
        )
      } else {
        setInviteGroups([])
      }
      setGroupsLoading(false)
      return
    }

    const { data: groupsData, error: groupsErrorLoad } = await supabase
      .from('groups')
      .select('id,name,owner_user_id,created_at')
      .in('id', groupIds)
      .order('created_at', { ascending: false })

    if (groupsErrorLoad) {
      setGroupsLoading(false)
      setGroupsError('No se pudieron cargar los datos del grupo.')
      return
    }

    const mappedGroups: Group[] = (groupsData ?? []).map((item) => ({
      id: String(item.id), name: String(item.name),
      ownerUserId: String(item.owner_user_id), createdAt: String(item.created_at),
    }))

    const { data: allMembers, error: allMembersError } = await supabase
      .from('group_members')
      .select('id,group_id,user_id,role,status')
      .in('group_id', groupIds)
      .eq('status', 'active')

    if (allMembersError) {
      setGroupsLoading(false)
      setGroupsError('No se pudieron cargar los miembros del grupo.')
      return
    }

    const userIds = [...new Set((allMembers ?? []).map((i) => String(i.user_id)))]
    const { data: profilesData } = await supabase.from('profiles').select('id,display_name').in('id', userIds)
    const profileNameByUserId = new Map(
      (profilesData ?? []).map((i) => [String(i.id), String(i.display_name ?? '').trim()]),
    )

    const membersByGroup: Record<string, GroupMember[]> = {}
    ;(allMembers ?? []).forEach((member) => {
      const gId = String(member.group_id)
      const uId = String(member.user_id)
      const fallbackName = uId === uid ? 'Tú' : `Miembro ${uId.slice(0, 6)}`
      const mapped: GroupMember = {
        id: String(member.id), groupId: gId, userId: uId,
        role: member.role as GroupMember['role'],
        status: member.status as GroupMember['status'],
        displayName: profileNameByUserId.get(uId) || fallbackName,
      }
      if (!membersByGroup[gId]) membersByGroup[gId] = []
      membersByGroup[gId].push(mapped)
    })

    Object.keys(membersByGroup).forEach((gId) => {
      membersByGroup[gId].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' }),
      )
    })

    setGroups(mappedGroups)
    setGroupMembersByGroup(membersByGroup)

    const joinedIds = new Set(mappedGroups.map((g) => g.id))
    const pendingIds = (invitesData ?? []).map((i) => String(i.group_id)).filter((id) => !joinedIds.has(id))
    if (pendingIds.length > 0) {
      const { data: igData } = await supabase
        .from('groups')
        .select('id,name,owner_user_id,created_at')
        .in('id', pendingIds)
      setInviteGroups(
        (igData ?? []).map((g) => ({
          id: String(g.id), name: String(g.name),
          ownerUserId: String(g.owner_user_id), createdAt: String(g.created_at),
        })),
      )
    } else {
      setInviteGroups([])
    }

    const nextGroupId = mappedGroups.find((g) => g.id === selectedGroupId)?.id ?? mappedGroups[0]?.id ?? ''
    setSelectedGroupId(nextGroupId)

    const candidates = membersByGroup[nextGroupId] ?? []
    setGroupExpensePayerMemberId(candidates[0]?.id ?? '')
    setGroupExpenseParticipantIds(candidates.map((m) => m.id))

    if (nextGroupId) {
      await loadGroupMonthBalances(nextGroupId)
      await loadGroupScopedSubscriptions(nextGroupId)
    } else {
      setGroupBalances([])
      setGroupMonthTotal(0)
      setGroupScopedSubscriptions([])
    }

    setGroupsLoading(false)
  }, [loadGroupMonthBalances, loadGroupScopedSubscriptions, selectedGroupId])

  // ── Handlers ────────────────────────────────
  const handleSelectGroup = useCallback(async (groupId: string) => {
    setSelectedGroupId(groupId)
    const members = groupMembersByGroup[groupId] ?? []
    if (members.length > 0) {
      setGroupExpensePayerMemberId(members[0].id)
      setGroupExpenseParticipantIds(members.map((m) => m.id))
    } else {
      setGroupExpensePayerMemberId('')
      setGroupExpenseParticipantIds([])
    }
    await loadGroupMonthBalances(groupId)
    await loadGroupScopedSubscriptions(groupId)
  }, [groupMembersByGroup, loadGroupMonthBalances, loadGroupScopedSubscriptions])

  const handleChangeProfileContext = useCallback((value: string) => {
    setActiveProfileContext(value)
    if (value === 'personal') return
    const nextGroupId = value.replace('group:', '')
    if (nextGroupId) void handleSelectGroup(nextGroupId)
  }, [handleSelectGroup, setActiveProfileContext])

  const handleCreateGroup = useCallback(async (userId: string | null, email: string) => {
    if (!supabase || !userId) return
    const name = newGroupName.trim()
    if (!name) { setGroupsError('Escribe un nombre de grupo.'); return }

    setGroupsLoading(true)
    setGroupsError('')
    setGroupsSuccess('')

    const groupId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })

    const { error } = await supabase.from('groups').insert({ id: groupId, name, owner_user_id: userId })
    if (error) { setGroupsLoading(false); setGroupsError(error.message || 'No se pudo crear el grupo.'); return }

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupId, user_id: userId, role: 'owner', status: 'active',
      joined_at: new Date().toISOString(),
    })
    if (memberError) { setGroupsLoading(false); setGroupsError(memberError.message || 'Grupo creado, pero no se pudo asignar el propietario.'); return }

    setNewGroupName('')
    setGroupsSuccess('Grupo creado correctamente.')
    await loadGroupsContext(userId, email)
    setGroupsLoading(false)
  }, [loadGroupsContext, newGroupName])

  const handleInviteMember = useCallback(async (userId: string | null, email: string) => {
    if (!supabase || !userId || !effectiveSelectedGroupId) return
    const targetEmail = inviteEmailInput.trim().toLowerCase()
    setGroupsLoading(true)
    setGroupsError('')
    setGroupsSuccess('')

    const inviteToken = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })
    const { error } = await supabase.from('group_invites').insert({
      group_id: effectiveSelectedGroupId, invited_by_user_id: userId,
      invitee_email: targetEmail || 'invite-link@gestionsub.local',
      token: inviteToken, status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) { setGroupsLoading(false); setGroupsError('No se pudo crear la invitación. ' + error.message); return }

    const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${inviteToken}`
    setLastInviteLink(inviteLink)
    setInviteEmailInput('')
    setGroupsSuccess(targetEmail ? `Invitación creada para ${targetEmail}.` : 'Enlace de invitación generado.')
    await loadGroupsContext(userId, email)
    setGroupsLoading(false)
  }, [effectiveSelectedGroupId, inviteEmailInput, loadGroupsContext])

  const handleAcceptInviteByToken = useCallback(async (token: string, uid: string, userEmail?: string) => {
    if (!supabase || !token || !uid) return
    setPendingInviteToken('')
    sessionStorage.removeItem('gestionsub.pendingInvite')
    const { data, error } = await supabase.rpc('accept_group_invite', { p_token: token })
    const result = data as { ok: boolean; reason?: string } | null
    if (error || !result?.ok) {
      const reason = result?.reason ?? error?.message ?? ''
      if (reason !== 'invite_not_found_or_expired') setGroupsError('No se pudo unir al grupo: ' + reason)
      return
    }
    await loadGroupsContext(uid, userEmail ?? '')
    setGroupsSuccess('¡Te has unido al grupo!')
  }, [loadGroupsContext])

  const handleAcceptInvite = useCallback(async (inviteId: string, userId: string | null, email: string) => {
    if (!supabase || !userId) return
    setGroupsLoading(true)
    setGroupsError('')
    const { data, error } = await supabase.rpc('accept_group_invite_by_id', { p_invite_id: inviteId })
    const result = data as { ok: boolean; reason?: string } | null
    if (error || !result?.ok) {
      setGroupsLoading(false)
      setGroupsError('No se pudo aceptar la invitación: ' + (result?.reason ?? error?.message ?? ''))
      return
    }
    await loadGroupsContext(userId, email)
    setGroupsSuccess('Invitación aceptada. ¡Bienvenido al grupo!')
    setGroupsLoading(false)
  }, [loadGroupsContext])

  const handleDeclineInvite = useCallback(async (inviteId: string, userId: string | null, email: string) => {
    if (!supabase || !userId) return
    setGroupsLoading(true)
    setGroupsError('')
    await supabase.from('group_invites').update({ status: 'revoked' }).eq('id', inviteId)
    await loadGroupsContext(userId, email)
    setGroupsLoading(false)
  }, [loadGroupsContext])

  // Show invite modal when logged in user opens invite link
  useEffect(() => {
    // This effect is triggered by the consumer passing isAuthenticated + userId
    // We leave the actual trigger to App.tsx to avoid circular deps
  }, [])

  const checkPendingInviteModal = useCallback(async (_userId: string) => {
    if (!pendingInviteToken || !supabase) return
    const client = supabase
    const { data: inviteRow } = await client
      .from('group_invites')
      .select('group_id')
      .eq('token', pendingInviteToken)
      .eq('status', 'pending')
      .maybeSingle()
    if (!inviteRow) {
      setPendingInviteToken('')
      sessionStorage.removeItem('gestionsub.pendingInvite')
      return
    }
    const { data: groupRow } = await client
      .from('groups')
      .select('name')
      .eq('id', String(inviteRow.group_id))
      .maybeSingle()
    setInviteModalGroupName(String(groupRow?.name ?? 'un grupo'))
    setShowInviteModal(true)
  }, [pendingInviteToken])

  const resetGroups = useCallback(() => {
    setGroups([])
    setGroupMembersByGroup({})
    setIncomingInvites([])
    setSelectedGroupId('')
    setGroupBalances([])
    setGroupMonthTotal(0)
    setActiveProfileContext('personal')
  }, [setActiveProfileContext])

  return {
    // State
    groups, groupMembersByGroup, incomingInvites, inviteGroups,
    selectedGroupId, groupBalances, groupsError, setGroupsError, groupsSuccess, setGroupsSuccess,
    newGroupName, setNewGroupName,
    inviteEmailInput, setInviteEmailInput,
    lastInviteLink, setLastInviteLink,
    showProfileMenu, setShowProfileMenu,
    showInviteModal, setShowInviteModal,
    inviteModalGroupName, inviteModalLoading, setInviteModalLoading,
    groupExpensePayerMemberId, setGroupExpensePayerMemberId,
    groupExpenseParticipantIds, setGroupExpenseParticipantIds,
    groupScopedSubscriptions,
    activeProfileContext, setActiveProfileContext,
    pendingInviteToken, setPendingInviteToken,
    // Derived
    isGroupProfileActive, groupProfileId, effectiveSelectedGroupId,
    activeProfileLabel, selectedGroupMembers, groupReceivables, groupDebts,
    // Loaders
    loadGroupsContext, loadGroupMonthBalances, loadGroupScopedSubscriptions,
    // Handlers
    handleChangeProfileContext, handleCreateGroup, handleInviteMember,
    handleAcceptInviteByToken, handleAcceptInvite, handleDeclineInvite,
    checkPendingInviteModal, resetGroups,
  }
}
