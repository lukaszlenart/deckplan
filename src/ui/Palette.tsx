import { GROUPS, moduleDef } from '../domain/catalogue'
import { useLocalize } from '../i18n'
import { beginNewDrag } from './pointer'
import { store } from './store'
import { ModuleThumb } from './svg/ModuleThumb'

export function Palette() {
  const localize = useLocalize()
  const pending = store.pending.value
  return (
    <div id="palette">
      {GROUPS.map((g) => (
        <section key={g.id} style="margin-bottom:14px">
          <h2>{localize(g.label)}</h2>
          <div class="group">
            {g.modules.map((id) => {
              const d = moduleDef(id)
              const name = localize(d.name)
              return (
                <div
                  key={id}
                  class={`item${pending?.module === id ? ' active' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={name}
                  title={`${name} (${d.code})`}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    const r = pending?.module === id ? pending.r : 0
                    store.drag.value = beginNewDrag(id, r, e)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      store.togglePending(id)
                    }
                  }}
                >
                  <ModuleThumb id={id} />
                  <span>{name}</span>
                  <code>{d.code}</code>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
