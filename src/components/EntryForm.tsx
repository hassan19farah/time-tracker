import { useState, type CSSProperties, type FormEvent } from 'react'
import { newId } from '../store'
import {
  findOverlaps,
  formatDuration,
  formatTime,
  minutesBetween,
  MINUTES_PER_DAY,
  parseTags,
  parseTime,
  toISODate,
} from '../time'
import type { Category, Entry } from '../types'
import { Sheet } from './Sheet'

interface Props {
  /** Entry being edited, or null to add a new one. */
  entry: Entry | null
  /** Day selected in the day view; the default date for a new entry. */
  day: string
  categories: Category[]
  entries: Entry[]
  onSave: (entry: Entry) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

type Mode = 'range' | 'duration'

/** New entries start where the day's latest entry ended, for quick hour-by-hour logging. */
function defaultStart(day: string, entries: Entry[]): string {
  let latestEnd: number | null = null
  for (const e of entries) {
    if (e.date !== day || !e.start) continue
    const s = parseTime(e.start)
    if (s === null) continue
    const end = Math.min(s + e.minutes, MINUTES_PER_DAY - 60)
    if (latestEnd === null || end > latestEnd) latestEnd = end
  }
  if (latestEnd !== null) return formatTime(latestEnd)
  if (day === toISODate(new Date())) {
    return formatTime(Math.max(0, new Date().getHours() - 1) * 60)
  }
  return '09:00'
}

export function EntryForm({ entry, day, categories, entries, onSave, onDelete, onClose }: Props) {
  const initialStart = entry?.start ?? defaultStart(day, entries)
  const selectable = categories
    .filter((c) => !c.hidden || entry?.categoryIds.includes(c.id))
    .sort((a, b) => a.order - b.order)

  const [date, setDate] = useState(entry?.date ?? day)
  const [mode, setMode] = useState<Mode>(entry && !entry.start ? 'duration' : 'range')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(entry?.end ?? formatTime((parseTime(initialStart) ?? 0) + 60))
  const [hours, setHours] = useState(entry && !entry.start ? String(Math.floor(entry.minutes / 60)) : '1')
  const [mins, setMins] = useState(entry && !entry.start ? String(entry.minutes % 60) : '0')
  const [categoryIds, setCategoryIds] = useState<string[]>(entry?.categoryIds ?? [])
  const [tagsText, setTagsText] = useState(entry?.tags.join(', ') ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minutes =
    mode === 'range'
      ? minutesBetween(start, end)
      : (Number(hours) || 0) * 60 + (Number(mins) || 0)

  const durationProblem =
    mode === 'range'
      ? minutes === null
        ? 'Start and end must be valid and different.'
        : null
      : !Number.isInteger(Number(hours)) || !Number.isInteger(Number(mins)) || Number(hours) < 0 || Number(mins) < 0
        ? 'Use whole numbers for hours and minutes.'
        : !minutes
          ? 'Duration must be more than 0.'
          : minutes > MINUTES_PER_DAY
            ? 'Duration can be at most 24 hours.'
            : null

  const overlaps =
    mode === 'range' && minutes
      ? findOverlaps({ id: entry?.id ?? '', date, start, minutes }, entries)
      : []
  const crossesMidnight =
    mode === 'range' && minutes !== null && (parseTime(start) ?? 0) + minutes > MINUTES_PER_DAY

  const categoryNames = (ids: string[]) =>
    ids.map((id) => categories.find((c) => c.id === id)?.name ?? 'Unknown').join(' + ')

  const toggleCategory = (id: string) =>
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (durationProblem || !minutes) return setError(durationProblem)
    if (categoryIds.length === 0) return setError('Choose at least one category.')
    if (!date) return setError('Choose a date.')
    const now = new Date().toISOString()
    setBusy(true)
    setError(null)
    try {
      await onSave({
        id: entry?.id ?? newId(),
        date,
        start: mode === 'range' ? start : null,
        end: mode === 'range' ? end : null,
        minutes,
        categoryIds,
        tags: parseTags(tagsText),
        note: note.trim(),
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!entry || !confirm('Delete this entry?')) return
    setBusy(true)
    try {
      await onDelete(entry.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
      setBusy(false)
    }
  }

  return (
    <Sheet title={entry ? 'Edit entry' : 'Add entry'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <div className="segmented" role="radiogroup" aria-label="How to record the time">
          {(['range', 'duration'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
            >
              {m === 'range' ? 'Start & end' : 'Duration only'}
            </button>
          ))}
        </div>

        {mode === 'range' ? (
          <div className="row">
            <label className="field">
              <span>Start</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="field">
              <span>End</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
        ) : (
          <div className="row">
            <label className="field">
              <span>Hours</span>
              <input type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
            <label className="field">
              <span>Minutes</span>
              <input type="number" inputMode="numeric" min={0} max={59} step={5} value={mins} onChange={(e) => setMins(e.target.value)} />
            </label>
          </div>
        )}

        <p className="hint" aria-live="polite">
          {durationProblem ?? (
            <>
              {formatDuration(minutes ?? 0)}
              {crossesMidnight && ' · ends the next day'}
            </>
          )}
        </p>

        {overlaps.length > 0 && (
          <p className="warning" role="status">
            Overlaps with{' '}
            {overlaps
              .map((o) => `${categoryNames(o.categoryIds)} (${o.start}–${o.end}${o.date !== date ? `, ${o.date}` : ''})`)
              .join(', ')}
            . You can still save it.
          </p>
        )}

        <fieldset className="field">
          <legend>What did you do? (pick one or more)</legend>
          {selectable.length === 0 ? (
            <p className="hint">No categories yet. Add one in the Categories tab.</p>
          ) : (
            <div className="chips">
              {selectable.map((c) => (
                <label key={c.id} className="chip-option" style={{ '--chip': c.color } as CSSProperties}>
                  <input
                    type="checkbox"
                    value={c.id}
                    checked={categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="field">
          <span>Tags (optional, separate with commas)</span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="e.g. reading, gym"
            autoCapitalize="none"
          />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          {entry && (
            <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
