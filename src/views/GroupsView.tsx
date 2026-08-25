import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus } from 'lucide-react'
import type { Group, GroupInvite, GroupMember } from '../types'
import { hasSupabase } from '../lib/supabase'

export type GroupsViewProps = {
  activeProfileContext: string
  isGroupProfileActive: boolean
  canUseGroups: boolean
  canManageGroupExpenses: boolean
  groups: Group[]
  groupMembersByGroup: Record<string, GroupMember[]>
  incomingInvites: GroupInvite[]
  inviteGroups: Group[]
  groupsError: string
  groupsSuccess: string
  newGroupName: string
  setNewGroupName: (v: string) => void
  groupNameInput: string
  setGroupNameInput: (v: string) => void
  inviteEmailInput: string
  setInviteEmailInput: (v: string) => void
  lastInviteLink: string
  setLastInviteLink: (v: string) => void
  handleChangeProfileContext: (value: string) => void
  handleCreateGroup: () => Promise<void>
  handleRenameGroup: () => Promise<void>
  handleInviteMember: () => Promise<void>
  handleAcceptInvite: (inviteId: string) => Promise<void>
  handleDeclineInvite: (inviteId: string) => Promise<void>
  setGroupsSuccess: (v: string) => void
}

export function GroupsView({
  activeProfileContext,
  isGroupProfileActive,
  canUseGroups,
  canManageGroupExpenses,
  groups,
  groupMembersByGroup,
  incomingInvites,
  inviteGroups,
  groupsError,
  groupsSuccess,
  newGroupName,
  setNewGroupName,
  groupNameInput,
  setGroupNameInput,
  inviteEmailInput,
  setInviteEmailInput,
  lastInviteLink,
  setLastInviteLink,
  handleChangeProfileContext,
  handleCreateGroup,
  handleRenameGroup,
  handleInviteMember,
  handleAcceptInvite,
  handleDeclineInvite,
  setGroupsSuccess,
}: GroupsViewProps) {
  const [showCreateForm, setShowCreateForm] = useState(groups.length === 0)
  const reducedMotion = Boolean(useReducedMotion())
  const selectedGroup = groups.find((group) => activeProfileContext === `group:${group.id}`) ?? null
  const selectedMembers = selectedGroup ? groupMembersByGroup[selectedGroup.id] ?? [] : []
  const selectedMemberLabel = selectedMembers.length === 1 ? 'miembro' : 'miembros'
  const hasGroupDetail = !showCreateForm && isGroupProfileActive && Boolean(selectedGroup)

  const onCreateGroup = async () => {
    await handleCreateGroup()
    setShowCreateForm(false)
  }

  const toggleCreateForm = () => {
    setShowCreateForm((current) => {
      const next = !current
      if (next) setNewGroupName('')
      return next
    })
  }

  return (
    <div className={hasGroupDetail ? 'groups-view has-group-detail' : 'groups-view'}>
      <div className="groups-top">
        <div>
          <h1>Grupos</h1>
        </div>
        <button type="button" className="groups-create-trigger" onClick={toggleCreateForm}>
          <Plus size={16} strokeWidth={2.4} />
          <span>{showCreateForm ? 'Cerrar' : 'Nuevo'}</span>
        </button>
      </div>

      {!canUseGroups && (
        <section className="groups-card groups-empty-card">
          <h2>Sin acceso a grupos</h2>
          <p>{hasSupabase ? 'Inicia sesión para crear grupos y sincronizar miembros.' : 'Configura Supabase para activar grupos sincronizados.'}</p>
        </section>
      )}

      {canUseGroups && (
        <>
          <AnimatePresence initial={false}>
            {(groupsError || groupsSuccess) && (
              <motion.section
                className="groups-feedback"
                initial={reducedMotion ? false : { opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.16 }}
              >
              {groupsError && <p className="dash-msg dash-msg--err">{groupsError}</p>}
              {groupsSuccess && <p className="dash-msg dash-msg--ok">{groupsSuccess}</p>}
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showCreateForm && (
              <motion.section
                className="groups-card groups-create-card"
                initial={reducedMotion ? false : { opacity: 0, y: -3, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -3, height: 0, pointerEvents: 'none' }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
              <div className="groups-section-top">
                <h2>Nuevo grupo</h2>
              </div>
              <div className="dash-manage-inline">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nombre del grupo" />
                <button type="button" onClick={() => void onCreateGroup()}>Crear</button>
              </div>
              </motion.section>
            )}
          </AnimatePresence>

          {incomingInvites.length > 0 && (
            <section className="groups-card groups-invites-card">
              <div className="groups-section-top">
                <h2>Invitaciones pendientes</h2>
              </div>
              {incomingInvites.map((invite) => {
                const name = inviteGroups.find((group) => group.id === invite.groupId)?.name ?? groups.find((group) => group.id === invite.groupId)?.name ?? 'Grupo'
                return (
                  <div key={invite.id} className="dash-invite-item">
                    <strong>{name}</strong>
                    <div>
                      <button type="button" className="accept" onClick={() => void handleAcceptInvite(invite.id)}>Aceptar</button>
                      <button type="button" className="decline" onClick={() => void handleDeclineInvite(invite.id)}>X</button>
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          <section className="groups-card groups-list-card">
            <div className="groups-section-top">
              <div>
                <h2>Tus grupos</h2>
                {groups.length > 0 && <small>{groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}</small>}
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="collection-empty compact">
                <strong>Tu primer grupo</strong>
                <span>Crea un grupo para compartir gastos e invitar miembros.</span>
              </div>
            ) : (
              <motion.div layout className="groups-list">
                {groups.map((group) => {
                  const memberCount = groupMembersByGroup[group.id]?.filter((member) => member.status === 'active').length ?? 0
                  const visibleMemberCount = memberCount || 1
                  const isSelected = !showCreateForm && selectedGroup?.id === group.id
                  return (
                    <motion.button
                      key={group.id}
                      layout="position"
                      type="button"
                      className={isSelected ? 'groups-list-item active' : 'groups-list-item'}
                      onClick={() => {
                        setShowCreateForm(false)
                        handleChangeProfileContext(`group:${group.id}`)
                      }}
                    >
                      <span className="groups-list-avatar">{group.name.charAt(0).toUpperCase()}</span>
                      <span className="groups-list-info">
                        <strong>{group.name}</strong>
                        <small>{visibleMemberCount} {visibleMemberCount === 1 ? 'miembro' : 'miembros'}</small>
                      </span>
                      <span className="groups-list-state">{isSelected ? 'Abierto' : ''}</span>
                    </motion.button>
                  )
                })}
              </motion.div>
            )}
          </section>

          <AnimatePresence initial={false} mode="popLayout">
            {hasGroupDetail && selectedGroup ? (
              <motion.section
                key={selectedGroup.id}
                className="groups-card groups-detail"
                initial={reducedMotion ? false : { opacity: 0.94, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2, pointerEvents: 'none' }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
              <div className="groups-section-top">
                <div>
                  <h2>{selectedGroup.name}</h2>
                  <small>{selectedMembers.length} {selectedMemberLabel}</small>
                </div>
              </div>

              <p className="dash-manage-label">Nombre del grupo</p>
              <div className="dash-manage-inline">
                <input
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="Nombre del grupo"
                />
                <button type="button" disabled={!canManageGroupExpenses} onClick={() => void handleRenameGroup()}>Guardar</button>
              </div>

              <p className="dash-manage-label">Miembros</p>
              <div className="dash-pills">
                {selectedMembers.map((member) => <span key={member.id}>{member.displayName}</span>)}
              </div>

              <p className="dash-manage-label">Invitar miembro</p>
              <div className="dash-manage-inline">
                <input
                  type="email"
                  value={inviteEmailInput}
                  onChange={(e) => { setInviteEmailInput(e.target.value); setLastInviteLink('') }}
                  placeholder="Email (opcional)"
                />
                <button type="button" onClick={() => void handleInviteMember()}>Invitar</button>
              </div>

              {lastInviteLink && (
                <div className="dash-invite-box">
                  <small>Comparte este enlace (7 días)</small>
                  <div className="dash-invite-row">
                    <code>{lastInviteLink}</code>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(lastInviteLink); setGroupsSuccess('Copiado') }}>Copiar</button>
                  </div>
                  <button type="button" className="link" onClick={() => setLastInviteLink('')}>Cerrar</button>
                </div>
              )}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
