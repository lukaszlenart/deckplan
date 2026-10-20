import { useEffect, useState } from 'preact/hooks'
import { useT } from '../i18n'
import { store } from './store'

const TOAST_MS = 1800

export function Toast() {
  const t = useT()
  const toast = store.toast.value
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!toast) return
    setOn(true)
    const timer = setTimeout(() => setOn(false), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast?.id])
  return (
    <div id="toast" role="status" class={on ? 'on' : ''}>
      {toast ? t(toast.key, toast.params) : ''}
    </div>
  )
}
