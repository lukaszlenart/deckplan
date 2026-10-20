import { signal } from '@preact/signals'
import type { Lang, Localized } from '../domain/types'
import { en, type MessageKey, type Messages } from './en'
import { pl } from './pl'

export type { MessageKey, Messages }

const DICTIONARIES: Record<Lang, Messages> = { en, pl }
const STORAGE_KEY = 'deckplan/lang'

export type Params = Record<string, string | number>
export type TFunction = (key: MessageKey, params?: Params) => string

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'pl'
}

/** Stored choice wins; otherwise the browser language; otherwise English. */
export function detectLang(stored: string | null, browserLanguage: string | undefined): Lang {
  if (isLang(stored)) return stored
  if (browserLanguage?.toLowerCase().startsWith('pl')) return 'pl'
  return 'en'
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function translate(l: Lang, key: MessageKey, params?: Params): string {
  return interpolate(DICTIONARIES[l][key], params)
}

/** Translates `<key>.<plural category>` for `n`, e.g. `unit.cell.few`, with `{count}` set. */
export function translatePlural(l: Lang, key: string, n: number): string {
  const category = new Intl.PluralRules(l).select(n)
  return translate(l, `${key}.${category}` as MessageKey, { count: n })
}

function readStoredLang(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export const lang = signal<Lang>(detectLang(readStoredLang(), globalThis.navigator?.language))

export function setLang(l: Lang): void {
  lang.value = l
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, l)
  } catch {
    // Storage unavailable (private mode, quota) — the choice just won't persist.
  }
}

/** Returns a translator bound to the current language; components re-render when it changes. */
export function useT(): TFunction {
  const l = lang.value
  return (key, params) => translate(l, key, params)
}

export function usePlural(): (key: string, n: number) => string {
  const l = lang.value
  return (key, n) => translatePlural(l, key, n)
}

/** Picks the current-language variant of catalogue text. */
export function useLocalize(): (text: Localized) => string {
  const l = lang.value
  return (text) => text[l]
}
