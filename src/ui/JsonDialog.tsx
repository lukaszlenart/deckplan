import { useRef, useState } from 'preact/hooks'
import { useT } from '../i18n'
import { importPlan } from '../storage/backup'
import { store } from './store'

interface Props {
  /** Export text shown when the dialog opens; mount with a fresh `key` per opening. */
  text: string
  onClose: () => void
}

export function JsonDialog({ text, onClose }: Props) {
  const t = useT()
  const [value, setValue] = useState(text)
  const area = useRef<HTMLTextAreaElement>(null)

  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => store.showToast('toast.copied'),
      () => {
        area.current?.select()
        store.showToast('toast.selectedText')
      },
    )
  }
  const load = () => {
    const result = importPlan(value)
    if (!result.ok) {
      store.showToast('toast.invalidJson')
      return
    }
    store.loadPlan(result.plan)
    store.showToast('toast.loaded')
    onClose()
  }

  return (
    <div class="modal" id="modal">
      <div class="box">
        <h2 style="margin:0">{t('dialog.title')}</h2>
        <p class="hint">{t('dialog.hint')}</p>
        <textarea
          id="jsonArea"
          ref={area}
          spellcheck={false}
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <div class="row" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="primary" onClick={copy}>
            {t('dialog.copy')}
          </button>
          <button onClick={load}>{t('dialog.load')}</button>
          <button style="margin-left:auto" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
