import { describe, expect, it } from 'vitest'
import { en } from './en'
import { pl } from './pl'
import { detectLang, translate, translatePlural } from './index'

describe('i18n', () => {
  it('pl has exactly the keys of en', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort())
  })

  it('detects language from storage, then browser', () => {
    expect(detectLang('pl', 'en-US')).toBe('pl')
    expect(detectLang(null, 'pl-PL')).toBe('pl')
    expect(detectLang('xx', 'de-DE')).toBe('en')
    expect(detectLang(null, undefined)).toBe('en')
  })

  it('interpolates params', () => {
    expect(translate('en', 'inspector.rotation', { deg: 90 })).toBe('rotation 90°')
    expect(translate('pl', 'inspector.placingBulkhead', { name: 'Drzwi' })).toBe(
      'Wstawianie: Drzwi',
    )
    expect(translate('en', 'bulkhead.title')).toBe('{name} (click to change)')
  })

  it('picks Polish plural forms', () => {
    expect(translatePlural('pl', 'unit.cell', 1)).toBe('1 pole')
    expect(translatePlural('pl', 'unit.cell', 3)).toBe('3 pola')
    expect(translatePlural('pl', 'unit.cell', 5)).toBe('5 pól')
    expect(translatePlural('en', 'unit.cell', 1)).toBe('1 cell')
    expect(translatePlural('en', 'unit.cell', 2)).toBe('2 cells')
  })
})
