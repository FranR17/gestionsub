import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

type ModalSurfaceProps = {
  open: boolean
  onClose: () => void
  titleId?: string
  descriptionId?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  closeDisabled?: boolean
  role?: 'dialog' | 'alertdialog'
  className?: string
  children: ReactNode
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ModalSurface({
  open,
  onClose,
  titleId,
  descriptionId,
  initialFocusRef,
  closeDisabled = false,
  role = 'dialog',
  className = '',
  children,
}: ModalSurfaceProps) {
  const generatedTitleId = useId()
  const panelRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const reducedMotion = Boolean(useReducedMotion())
  const closeFromEffect = useEffectEvent(() => {
    if (!closeDisabled) onClose()
  })
  const focusInitial = useEffectEvent(() => {
    const target = initialFocusRef?.current
      ?? panelRef.current?.querySelector<HTMLElement>(focusableSelector)
      ?? panelRef.current
    target?.focus()
  })

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const appShell = document.querySelector<HTMLElement>('main.app-shell')
    const wasInert = appShell?.inert ?? false
    const previousOverflow = document.body.style.overflow
    if (appShell) appShell.inert = true
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(focusInitial)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFromEffect()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown)
      if (appShell) appShell.inert = wasInert
      document.body.style.overflow = previousOverflow
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])

  if (typeof document === 'undefined') return null
  const theme = document.querySelector('main.app-shell')?.classList.contains('dark') ? 'dark' : 'light'

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`app-shell ${theme} modal-layer`}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !closeDisabled) onClose()
          }}
        >
          <motion.section
            ref={panelRef}
            className={`modal-surface ${className}`.trim()}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId ?? generatedTitleId}
            aria-describedby={descriptionId}
            aria-busy={closeDisabled}
            tabIndex={-1}
            initial={reducedMotion ? false : { opacity: 0.96, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
