import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type CustomSelectOption = {
  value: string
  label: string
}

type CustomSelectProps = {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
}

export function CustomSelect({ value, options, onChange, ariaLabel }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedOption = options[selectedIndex]

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  const open = () => {
    setActiveIndex(selectedIndex)
    setIsOpen(true)
  }

  const selectOption = (index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setActiveIndex(index)
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (options.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        open()
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + options.length) % options.length)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (!isOpen) open()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (isOpen) selectOption(activeIndex)
      else open()
      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div className={`custom-select${isOpen ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? `${listboxId}-${activeIndex}` : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="custom-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              type="button"
              id={`${listboxId}-${index}`}
              className={`custom-select-option${index === activeIndex ? ' active' : ''}`}
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              key={option.value}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectOption(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
