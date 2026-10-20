import { useEffect, useRef } from 'preact/hooks'

interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: EventTarget | null
}

const TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'range',
])

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; type?: string; isContentEditable?: boolean } | null
  if (!el?.tagName) return false
  const tag = el.tagName.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return !TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase())
  return el.isContentEditable === true
}

/**
 * Normalizes a key event to a shortcut name: `mod+z` for Ctrl/Cmd+Z,
 * otherwise the lower-cased key — but only when the user is not typing in a field.
 */
export function shortcutKey(e: KeyLike): string | null {
  if (isTypingTarget(e.target)) return null
  const mod = e.ctrlKey || e.metaKey
  if (mod && !e.altKey && e.key.toLowerCase() === 'z') return 'mod+z'
  if (mod || e.altKey) return null
  return e.key.length === 1 ? e.key.toLowerCase() : e.key
}

export function useShortcuts(handlers: Record<string, () => void>): void {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const key = shortcutKey(e)
      const handler = key ? ref.current[key] : undefined
      if (handler) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
