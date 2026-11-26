import type { CSSProperties } from 'react'
import { useToday } from '../useToday'
import { addDays, dayLabel, formatDuration, minutesByCategory, minutesByKind, parseISODate } from '../time'
import { PeriodNav } from './PeriodNav'
import { StatTiles } from './StatTiles'
import type { Category, Entry } from '../types'

interface Props {
  day: string
  setDay: (day: string) => void
  categories: Category[]
  entries: Entry[]
  onEdit: (entry: Entry) => void
}

/** Entries with times first, in time order; duration-only entries after, oldest first. */
function sortForDay(a: Entry, b: Entry): number {
  if (a.start && b.start) return a.start.localeCompare(b.start)
  if (a.start) return -1
  if (b.start) return 1
  return a.createdAt.localeCompare(b.createdAt)
}

/** Left-edge colour: solid for one category, striped for several. */
function stripe(cats: (Category | undefined)[]): string {
  const colors = cats.map((c) => c?.color ?? 'var(--muted)')
  if (colors.length <= 1) return colors[0] ?? 'var(--muted)'
  const step = 100 / colors.length
  return `linear-gradient(${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`
}

export function DayView({ day, setDay, categories, entries, onEdit }: Props) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const dayEntries = entries.filter((e) => e.date === day).sort(sortForDay)
  const total = dayEntries.reduce((sum, e) => sum + e.minutes, 0)
  const today = useToday()

  const kinds = minutesByKind(dayEntries, (id) => byId.get(id)?.kind)
  const pct = (m: number) => (total ? `${Math.round((m / total) * 100)}%` : undefined)
  const breakdown = [...minutesByCategory(dayEntries)].sort((a, b) => b[1] - a[1])

  return (
    <section aria-label="Day">
      <PeriodNav
        title={dayLabel(day, today)}
        subtitle={parseISODate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        prevLabel="Previous day"
        nextLabel="Next day"
        onPrev={() => setDay(addDays(day, -1))}
        onNext={() => setDay(addDays(day, 1))}
        backLabel={day !== today ? 'Back to today' : undefined}
        onBack={() => setDay(today)}
        renderTitle={(title) => (
          <label className="day-picker">
            {title}
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              aria-label="Pick a date"
            />
          </label>
        )}
      />

      <StatTiles
        stats={[
          { label: 'Productive', value: formatDuration(kinds.productive), detail: pct(kinds.productive) },
          { label: 'Unproductive', value: formatDuration(kinds.unproductive), detail: pct(kinds.unproductive) },
          { label: 'Logged', value: formatDuration(total), detail: 'of 24h' },
        ]}
      />

      <div className="day-summary">
        {breakdown.length > 0 && (
          <div className="stack-bar" role="img" aria-label={breakdown.map(([id, m]) => `${byId.get(id)?.name ?? 'Unknown'} ${formatDuration(Math.round(m))}`).join(', ')}>
            {breakdown.map(([id, m]) => (
              <span key={id} style={{ flexGrow: m, background: byId.get(id)?.color ?? 'var(--muted)' }} />
            ))}
          </div>
        )}
      </div>

      {dayEntries.length === 0 ? (
        <p className="empty">Nothing logged for this day yet. Tap “Add entry” to start.</p>
      ) : (
        <ul className="entry-list">
          {dayEntries.map((e) => {
            const cats = e.categoryIds.map((id) => byId.get(id))
            return (
              <li key={e.id}>
                <button type="button" className="entry" onClick={() => onEdit(e)} style={{ '--chip': stripe(cats) } as CSSProperties}>
                  <span className="entry-time">
                    {e.start ? (
                      <>
                        {e.start}
                        <br />
                        <span className="muted">{e.end}</span>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                  <span className="entry-main">
                    <span className="entry-title">
                      {cats.map((c, i) => (
                        <span key={e.categoryIds[i]} className="entry-cat" style={{ '--chip': c?.color ?? 'var(--muted)' } as CSSProperties}>
                          <span className="dot" aria-hidden="true" />
                          {c?.name ?? 'Deleted category'}
                        </span>
                      ))}
                    </span>
                    {e.note && <span className="entry-note">{e.note}</span>}
                    {e.tags.length > 0 && (
                      <span className="tags">
                        {e.tags.map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="entry-duration">{formatDuration(e.minutes)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
