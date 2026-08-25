import { useRef } from 'react'
import { ModalSurface } from './ModalSurface'

export type InviteModalProps = {
  open: boolean
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
  handleAcceptInviteByToken: (token: string, uid: string, email?: string) => Promise<boolean>
}

export function InviteModal({
  open,
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
  const rejectRef = useRef<HTMLButtonElement | null>(null)
  const handleClose = () => {
    if (!inviteModalLoading) {
      setPendingInviteToken('')
      sessionStorage.removeItem('gestionsub.pendingInvite')
      setShowInviteModal(false)
    }
  }

  return (
    <ModalSurface
      open={open}
      onClose={handleClose}
      titleId="invite-modal-title"
      descriptionId="invite-modal-description"
      initialFocusRef={rejectRef}
      closeDisabled={inviteModalLoading}
      className="modal-sheet"
    >
        <div className="modal-invite-icon">🎉</div>
        <h2 id="invite-modal-title" className="modal-invite-title">Invitación a grupo</h2>
        <p id="invite-modal-description" className="modal-invite-desc">
          Te han invitado a unirte a <strong>{inviteModalGroupName}</strong>.
          ¿Quieres aceptar la invitación?
        </p>
        {groupsError && (
          <p className="error-text" role="alert" style={{ textAlign: 'center', fontSize: '0.82rem' }}>
            {groupsError}
          </p>
        )}
        <div className="modal-invite-actions">
          <button
            type="button"
            ref={rejectRef}
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
              const accepted = await handleAcceptInviteByToken(pendingInviteToken, userId, email)
              setInviteModalLoading(false)
              if (accepted) setShowInviteModal(false)
            }}
          >
            {inviteModalLoading ? 'Uniéndome...' : '¡Unirme al grupo!'}
          </button>
        </div>
    </ModalSurface>
  )
}
