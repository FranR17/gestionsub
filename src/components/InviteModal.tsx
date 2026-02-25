export type InviteModalProps = {
  groupsError: string
  inviteModalGroupName: string
  inviteModalLoading: boolean
  pendingInviteToken: string
  userId: string | null
  email: string
  setPendingInviteToken: (v: string) => void
  setShowInviteModal: (v: boolean) => void
  setGroupsError: (v: string) => void
  setInviteModalLoading: (v: boolean) => void
  handleAcceptInviteByToken: (token: string, uid: string, email?: string) => Promise<void>
}

export function InviteModal({
  groupsError,
  inviteModalGroupName,
  inviteModalLoading,
  pendingInviteToken,
  userId,
  email,
  setPendingInviteToken,
  setShowInviteModal,
  setGroupsError,
  setInviteModalLoading,
  handleAcceptInviteByToken,
}: InviteModalProps) {
  const handleClose = () => {
    if (!inviteModalLoading) {
      setPendingInviteToken('')
      sessionStorage.removeItem('gestionsub.pendingInvite')
      setShowInviteModal(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-invite-icon">🎉</div>
        <h2 className="modal-invite-title">Invitación a grupo</h2>
        <p className="modal-invite-desc">
          Te han invitado a unirte a <strong>{inviteModalGroupName}</strong>.
          ¿Quieres aceptar la invitación?
        </p>
        {groupsError && (
          <p className="error-text" style={{ textAlign: 'center', fontSize: '0.82rem' }}>
            {groupsError}
          </p>
        )}
        <div className="modal-invite-actions">
          <button
            type="button"
            className="secondary"
            disabled={inviteModalLoading}
            onClick={handleClose}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="primary"
            disabled={inviteModalLoading}
            onClick={async () => {
              if (!userId) return
              setInviteModalLoading(true)
              setGroupsError('')
              await handleAcceptInviteByToken(pendingInviteToken, userId, email)
              setInviteModalLoading(false)
              setShowInviteModal(false)
            }}
          >
            {inviteModalLoading ? 'Uniéndome...' : '¡Unirme al grupo!'}
          </button>
        </div>
      </div>
    </div>
  )
}
