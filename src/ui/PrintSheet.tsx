import { planBounds } from '../domain/analysis'
import { store } from './store'
import { PlanDrawing } from './svg/PlanDrawing'

/** Hidden on screen; the print stylesheet shows it instead of the editor. */
export function PrintSheet() {
  const plan = store.plan.value
  const { x, y, w, h } = planBounds(plan)
  return (
    <section class="print-sheet" aria-hidden="true">
      <h1>{plan.name}</h1>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${x} ${y} ${w} ${h}`}>
        <PlanDrawing
          plan={plan}
          edges={store.analysis.value.edges}
          doors={store.analysis.value.doors}
          idPrefix="print"
        />
      </svg>
    </section>
  )
}
