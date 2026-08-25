import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import type { View } from '../types'

export type ViewTransitionState = {
  from: View
  to: View
}

type ViewTransitionProps = {
  view: View
  state: ViewTransitionState
  children: ReactNode
}

type TransitionContext = ViewTransitionState & {
  reducedMotion: boolean
}

const viewLabels: Record<View, string> = {
  dashboard: 'Inicio',
  subscriptions: 'Suscripciones',
  form: 'Formulario de suscripcion',
  timeline: 'Calendario',
  groups: 'Grupos',
  settings: 'Ajustes',
  settlements: 'Liquidaciones',
}

const viewVariants: Variants = {
  enter: ({ from, to, reducedMotion }: TransitionContext) => {
    if (reducedMotion) return { opacity: 1, x: 0, y: 0, scale: 1 }
    if (to === 'form') return { opacity: 0.94, x: 0, y: 12, scale: 1 }
    if (from === 'form') return { opacity: 0.96, x: 0, y: -2, scale: 1 }
    return { opacity: 0.96, x: 0, y: 2, scale: 1 }
  },
  visible: ({ from, to, reducedMotion }: TransitionContext) => ({
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: reducedMotion
      ? { duration: 0 }
      : {
          duration: from === 'form' || to === 'form' ? 0.2 : 0.18,
          ease: [0.16, 1, 0.3, 1],
        },
  }),
  exit: ({ from, to, reducedMotion }: TransitionContext) => {
    if (reducedMotion) {
      return { opacity: 1, x: 0, y: 0, scale: 1, pointerEvents: 'none', transition: { duration: 0 } }
    }
    if (from === 'form') {
      return {
        opacity: 0.96,
        x: 0,
        y: 12,
        scale: 1,
        pointerEvents: 'none',
        transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
      }
    }
    if (to === 'form') {
      return {
        opacity: 0.96,
        x: 0,
        y: -4,
        scale: 1,
        pointerEvents: 'none',
        transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
      }
    }
    return { opacity: 1, x: 0, y: 0, scale: 1, pointerEvents: 'none', transition: { duration: 0 } }
  },
}

export function ViewTransition({ view, state, children }: ViewTransitionProps) {
  const reducedMotion = Boolean(useReducedMotion())
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    const frame = window.requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [view])

  const context: TransitionContext = { ...state, reducedMotion }

  return (
    <AnimatePresence initial={false} mode="popLayout" custom={context}>
      <motion.div
        ref={contentRef}
        key={view}
        className="view-transition-layer"
        role="region"
        aria-label={viewLabels[view]}
        tabIndex={-1}
        custom={context}
        variants={viewVariants}
        initial="enter"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
