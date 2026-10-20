import { describe, expect, it } from 'vitest'
import { shortcutKey } from './shortcuts'

const ev = (
  key: string,
  target: unknown = null,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
  target: target as EventTarget | null,
})

describe('shortcutKey', () => {
  it('maps plain keys outside fields', () => {
    expect(shortcutKey(ev('R'))).toBe('r')
    expect(shortcutKey(ev('/', { tagName: 'BUTTON' }))).toBe('/')
    expect(shortcutKey(ev('n', { tagName: 'INPUT', type: 'checkbox' }))).toBe('n')
  })

  it('ignores keys typed into fields', () => {
    expect(shortcutKey(ev('r', { tagName: 'INPUT', type: 'text' }))).toBeNull()
    expect(shortcutKey(ev('r', { tagName: 'TEXTAREA' }))).toBeNull()
    expect(shortcutKey(ev('r', { tagName: 'DIV', isContentEditable: true }))).toBeNull()
  })

  it('handles Ctrl/Cmd+Z outside fields and ignores other modified keys', () => {
    expect(shortcutKey(ev('z', { tagName: 'TEXTAREA' }, { ctrlKey: true }))).toBeNull()
    expect(shortcutKey(ev('z', null, { ctrlKey: true }))).toBe('mod+z')
    expect(shortcutKey(ev('Z', null, { metaKey: true }))).toBe('mod+z')
    expect(shortcutKey(ev('r', null, { ctrlKey: true }))).toBeNull()
    expect(shortcutKey(ev('r', null, { altKey: true }))).toBeNull()
  })
})
