import { formatDuration } from '../time'
import { KIND_LABEL, KINDS, type Kind } from '../types'

interface Props {
  totals: Record<Kind, number>
}

const R = 40
const STROKE = 16
const CIRCUMFERENCE = 2 * Math.PI * R
const GAP = 1.5 // surface-coloured gap between slices, in viewBox units

/** Share of logged time per group, with the productive share in the middle. */
export function Donut({ totals }: Props) {
  const logged = KINDS.reduce((sum, k) => sum + totals[k], 0)
  if (logged === 0) return null
  const pct = (m: number) => Math.round((m / logged) * 100)
  const present = KINDS.filter((k) => totals[k] > 0)

  const gap = present.length > 1 ? GAP : 0
  const lengths = present.map((k) => (totals[k] / logged) * CIRCUMFERENCE)
  const slices = present.map((k, i) => ({
    k,
    dash: `${Math.max(lengths[i] - gap, 0.5)} ${CIRCUMFERENCE}`,
    offset: -lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }))

  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={KINDS.map((k) => `${KIND_LABEL[k]} ${pct(totals[k])}%`).join(', ')}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        <g transform="rotate(-90 50 50)">
          {slices.map((s) => (
            <circle
              key={s.k}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={`var(--kind-${s.k})`}
              strokeWidth={STROKE}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
            >
              <title>{`${KIND_LABEL[s.k]}: ${formatDuration(Math.round(totals[s.k]))} (${pct(totals[s.k])}%)`}</title>
            </circle>
          ))}
        </g>
        <text x="50" y="49" textAnchor="middle" className="donut-value">
          {pct(totals.productive)}%
        </text>
        <text x="50" y="61" textAnchor="middle" className="donut-label">
          productive
        </text>
      </svg>
      <ul className="donut-legend">
        <li className="dl-head" aria-hidden="true">
          <span />
          <span>Out of {formatDuration(Math.round(logged))} logged</span>
          <span>Hours</span>
          <span>Share</span>
        </li>
        {KINDS.map((k) => (
          <li key={k}>
            <span className={`swatch kind-${k}`} aria-hidden="true" />
            <span className="dl-name">{KIND_LABEL[k]}</span>
            <span className="dl-value">{formatDuration(Math.round(totals[k]))}</span>
            <span className="dl-pct">{pct(totals[k])}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
