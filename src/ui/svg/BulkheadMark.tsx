import { edgeCenter } from '../../domain/geometry'
import type { BulkheadType, EdgeKey } from '../../domain/types'
import { useT } from '../../i18n'

interface Props {
  edge: EdgeKey
  type: BulkheadType
  hasRoom: boolean
}

export function BulkheadMark({ edge, type, hasRoom }: Props) {
  const t = useT()
  const vertical = edge.endsWith('E')
  const [cx, cy] = edgeCenter(edge)
  const bar = (len: number, th: number, fill: string, extra: Record<string, string> = {}) =>
    vertical ? (
      <rect x={cx - th / 2} y={cy - len / 2} width={th} height={len} fill={fill} {...extra} />
    ) : (
      <rect x={cx - len / 2} y={cy - th / 2} width={len} height={th} fill={fill} {...extra} />
    )
  let mark: preact.JSX.Element | null
  if (type === 'open') {
    mark = hasRoom ? null : <circle cx={cx} cy={cy} r=".05" fill="var(--corr-edge)" opacity=".7" />
  } else if (type === 'door') {
    mark = bar(0.42, 0.09, 'var(--bh-door)')
  } else if (type === 'bulkhead') {
    mark = bar(0.5, 0.16, 'var(--bh-pressure)', {
      stroke: 'var(--bh-pressure-edge)',
      'stroke-width': '.03',
    })
  } else if (type === 'airlock') {
    const shift = vertical
      ? ['translate(-.07 0)', 'translate(.07 0)']
      : ['translate(0 -.07)', 'translate(0 .07)']
    mark = (
      <>
        {bar(0.5, 0.07, 'var(--bh-airlock)', { transform: shift[0] ?? '' })}
        {bar(0.5, 0.07, 'var(--bh-airlock)', { transform: shift[1] ?? '' })}
      </>
    )
  } else {
    mark = (
      <>
        {bar(0.5, 0.16, 'var(--bh-welded)')}
        <path
          d={`M${cx - 0.12} ${cy - 0.12}L${cx + 0.12} ${cy + 0.12}M${cx + 0.12} ${cy - 0.12}L${cx - 0.12} ${cy + 0.12}`}
          stroke="var(--bh-welded-mark)"
          stroke-width=".04"
        />
      </>
    )
  }
  const hit = vertical
    ? { x: cx - 0.22, y: cy - 0.3, width: 0.44, height: 0.6 }
    : { x: cx - 0.3, y: cy - 0.22, width: 0.6, height: 0.44 }
  return (
    <>
      {mark}
      <rect class="door" data-edge={edge} {...hit} fill="transparent">
        <title>{t('bulkhead.title', { name: t(`bulkhead.${type}`) })}</title>
      </rect>
    </>
  )
}
