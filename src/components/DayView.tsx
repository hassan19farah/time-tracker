import type { CSSProperties } from 'react'
import { useToday } from '../useToday'
import { addDays, dayLabel, formatDuration, minutesByCategory, minutesByKind, MINUTES_PER_DAY } from '../time'
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

  const productive = minutesByKind(dayEntries, (id) => byId.get(id)?.kind).productive
  const breakdown = [...minutesByCategory(dayEntries)].sort((a, b) => b[1] - a[1])

  return (
    <section aria-label="Day">
      <div className="day-nav">
        <button type="button" className="icon-button" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
          ‹
        </button>
        <label className="day-picker">
          <span className="day-label">{dayLabel(day, today)}</span>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            aria-label="Pick a date"
          />
        </label>
        <button type="button" className="icon-button" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
          ›
        </button>
      </div>
      {day !== today && (
        <button type="button" className="link-button today-button" onClick={() => setDay(today)}>
          Back to today
        </button>
      )}

      <div className="day-summary">
        <p>
          <strong>{formatDuration(total)}</strong> logged
          {total > 0 && (
            <>
              {' · '}
              <strong>{formatDuration(productive)}</strong> productive
            </>
          )}
          {total < MINUTES_PER_DAY && total > 0 && (
            <span className="muted"> · {formatDuration(MINUTES_PER_DAY - total)} unlogged</span>
          )}
        </p>
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
