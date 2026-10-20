import { LANGS } from '../../domain/types'
import { lang, setLang, useT } from '../../i18n'

export function LangSwitch() {
  const t = useT()
  return (
    <div class="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang.value === l}
          class={lang.value === l ? 'active' : ''}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
