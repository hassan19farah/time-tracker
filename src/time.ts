// Date and time helpers. Dates are local calendar dates as "YYYY-MM-DD",
// times are "HH:MM" (24-hour). Kept free of React so they're easy to test.

export const MINUTES_PER_DAY = 24 * 60

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** "HH:MM" -> minutes since midnight, or null if invalid. */
export function parseTime(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Minutes since midnight -> "HH:MM", wrapping past midnight. */
export function formatTime(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/**
 * Length of start..end in minutes. An end earlier than the start is read as
 * the next day (e.g. 23:00-01:00 = 120). Equal or invalid times give null.
 */
export function minutesBetween(start: string, end: string): number | null {
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === null || e === null) return null
  const diff = (e - s + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return diff === 0 ? null : diff
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function dayLabel(iso: string, today = toISODate(new Date())): string {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  })
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

interface Timed {
  id: string
  date: string
  start: string | null
  minutes: number
}

/** [start, end) in absolute minutes, so entries on different days compare correctly. */
function absoluteRange(e: Timed): [number, number] | null {
  if (!e.start) return null
  const s = parseTime(e.start)
  if (s === null) return null
  const from = dayNumber(e.date) * MINUTES_PER_DAY + s
  return [from, from + e.minutes]
}

/** Entries with a start time that overlap the candidate (ignoring itself). */
export function findOverlaps<T extends Timed>(candidate: Timed, entries: T[]): T[] {
  const range = absoluteRange(candidate)
  if (!range) return []
  return entries.filter((e) => {
    if (e.id === candidate.id) return false
    const other = absoluteRange(e)
    return other !== null && other[0] < range[1] && range[0] < other[1]
  })
}

/** "Deep work, #focus, deep work" -> ["Deep work", "focus"] */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of text.split(',')) {
    const tag = raw.trim().replace(/^#+/, '').trim()
    const key = tag.toLowerCase()
    if (tag && !seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
}

/** Minutes per category; a block with several categories is shared equally between them. */
export function minutesByCategory(entries: { minutes: number; categoryIds: string[] }[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const e of entries) {
    if (e.categoryIds.length === 0) continue
    const share = e.minutes / e.categoryIds.length
    for (const id of e.categoryIds) totals.set(id, (totals.get(id) ?? 0) + share)
  }
  return totals
}
