import { useState } from 'react'
import {
  addDays,
  formatDuration,
  minutesByCategory,
  minutesByKind,
  MINUTES_PER_DAY,
  parseISODate,
  startOfWeek,
} from '../time'
import { useToday } from '../useToday'
import { KIND_LABEL, KINDS, type Category, type Entry } from '../types'
import { Donut } from './Donut'

interface Props {
  day: string
  setDay: (day: string) => void
  categories: Category[]
  entries: Entry[]
  openDay: (day: string) => void
}

const hours = (m: number) => formatDuration(Math.round(m))
const shortDay = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })
const dayNum = (iso: string) => parseISODate(iso).getDate()
const longDay = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

function weekLabel(monday: string): string {
  const sunday = parseISODate(addDays(monday, 6))
  const first = parseISODate(monday)
  const sameMonth = first.getMonth() === sunday.getMonth()
  const end = sunday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const start = first.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${start} – ${end}`
}

export function WeekView({ day, setDay, categories, entries, openDay }: Props) {
  const monday = startOfWeek(day)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = useToday()
  const thisMonday = startOfWeek(today)
  const [picked, setPicked] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const byId = new Map(categories.map((c) => [c.id, c]))
  const kindOf = (id: string) => byId.get(id)?.kind
  const weekEntries = entries.filter((e) => e.date >= monday && e.date <= days[6])

  const perDay = days.map((d) => {
    const list = weekEntries.filter((e) => e.date === d)
    const kinds = minutesByKind(list, kindOf)
    return { date: d, kinds, logged: KINDS.reduce((sum, k) => sum + kinds[k], 0) }
  })
  const totals = minutesByKind(weekEntries, kindOf)
  const logged = KINDS.reduce((sum, k) => sum + totals[k], 0)
  const daysLogged = perDay.filter((d) => d.logged > 0).length

  const perCategory = [...minutesByCategory(weekEntries)].sort((a, b) => b[1] - a[1])
  const maxCategory = perCategory[0]?.[1] ?? 0

  const focus = perDay.find((d) => d.date === (hovered ?? picked ?? (days.includes(today) ? today : null)))

  return (
    <section aria-label="Week">
      <div className="day-nav">
        <button type="button" className="icon-button" onClick={() => setDay(addDays(monday, -7))} aria-label="Previous week">
          ‹
        </button>
        <span className="day-label">{monday === thisMonday ? 'This week' : weekLabel(monday)}</span>
        <button type="button" className="icon-button" onClick={() => setDay(addDays(monday, 7))} aria-label="Next week">
          ›
        </button>
      </div>
      {monday !== thisMonday ? (
        <button type="button" className="link-button today-button" onClick={() => setDay(today)}>
          Back to this week
        </button>
      ) : (
        <p className="muted small center">{weekLabel(monday)}</p>
      )}

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Productive</span>
          <span className="stat-value">{hours(totals.productive)}</span>
          <span className="stat-sub">{logged ? `${Math.round((totals.productive / logged) * 100)}% of logged time` : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Unproductive</span>
          <span className="stat-value">{hours(totals.unproductive)}</span>
          <span className="stat-sub">{logged ? `${Math.round((totals.unproductive / logged) * 100)}% of logged time` : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Logged</span>
          <span className="stat-value">{hours(logged)}</span>
          <span className="stat-sub">
            {daysLogged} of 7 days
          </span>
        </div>
      </div>

      {logged === 0 ? (
        <p className="empty">Nothing logged this week yet.</p>
      ) : (
        <>
          <h3 className="chart-title">Share of logged time</h3>
          <Donut totals={totals} />

          <h3 className="chart-title">Each day</h3>
          <ul className="legend" aria-label="Legend">
            {KINDS.map((k) => (
              <li key={k}>
                <span className={`swatch kind-${k}`} aria-hidden="true" />
                {KIND_LABEL[k]}
              </li>
            ))}
            <li>
              <span className="swatch unlogged" aria-hidden="true" />
              Not logged
            </li>
          </ul>

          <p className="readout" aria-live="polite">
            {focus ? (
              <>
                <strong>{longDay(focus.date)}</strong>
                <span>
                  {KINDS.map((k) => `${KIND_LABEL[k]} ${hours(focus.kinds[k])}`).join(' · ')}
                </span>
                <button type="button" className="link-button" onClick={() => openDay(focus.date)}>
                  Open this day ›
                </button>
              </>
            ) : (
              <span className="muted">Tap a day to see its breakdown.</span>
            )}
          </p>

          <div className="week-chart" role="group" aria-label="Hours per day">
            {perDay.map((d) => (
              <button
                key={d.date}
                type="button"
                className={`week-col${focus?.date === d.date ? ' is-focus' : ''}${d.date === today ? ' is-today' : ''}`}
                onClick={() => setPicked(d.date)}
                onMouseEnter={() => setHovered(d.date)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(d.date)}
                onBlur={() => setHovered(null)}
                aria-label={`${longDay(d.date)}: ${d.logged ? KINDS.map((k) => `${KIND_LABEL[k]} ${hours(d.kinds[k])}`).join(', ') : 'nothing logged'}`}
              >
                <span className="week-track">
                  {/* bottom to top: productive, necessary, unproductive, rest */}
                  {KINDS.map((k) =>
                    d.kinds[k] > 0 ? (
                      <span
                        key={k}
                        className={`week-seg kind-${k}`}
                        style={{ height: `${(d.kinds[k] / MINUTES_PER_DAY) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
                <span className="week-day">
                  {shortDay(d.date)}
                  <span className="muted"> {dayNum(d.date)}</span>
                </span>
                <span className="week-value">{d.kinds.productive ? `${hours(d.kinds.productive)} prod.` : '–'}</span>
              </button>
            ))}
          </div>
          <p className="muted small center">Column height = 24 hours. “prod.” = productive time that day.</p>

          <details className="table-toggle">
            <summary>Show as table</summary>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  {KINDS.map((k) => (
                    <th key={k} scope="col">
                      {KIND_LABEL[k]}
                    </th>
                  ))}
                  <th scope="col">Logged</th>
                </tr>
              </thead>
              <tbody>
                {perDay.map((d) => (
                  <tr key={d.date}>
                    <th scope="row">
                      {shortDay(d.date)} {dayNum(d.date)}
                    </th>
                    {KINDS.map((k) => (
                      <td key={k}>{d.kinds[k] ? hours(d.kinds[k]) : '–'}</td>
                    ))}
                    <td>{d.logged ? hours(d.logged) : '–'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {KINDS.map((k) => (
                    <td key={k}>{hours(totals[k])}</td>
                  ))}
                  <td>{hours(logged)}</td>
                </tr>
              </tfoot>
            </table>
          </details>

          <h3 className="chart-title">By category</h3>
          <p className="muted small">Time in a block with several activities is shared equally between them.</p>
          <ul className="category-bars">
            {perCategory.map(([id, m]) => {
              const c = byId.get(id)
              return (
                <li key={id}>
                  <span className="cb-name">
                    {c?.name ?? 'Deleted category'}
                    {c && <span className="muted small"> · {KIND_LABEL[c.kind]}</span>}
                  </span>
                  <span className="cb-value">{hours(m)}</span>
                  <span className="cb-track" aria-hidden="true">
                    <span style={{ width: `${(m / maxCategory) * 100}%`, background: c?.color ?? 'var(--muted)' }} />
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
