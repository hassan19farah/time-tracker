export type Kind = 'productive' | 'neutral' | 'rest'

export const KINDS: Kind[] = ['productive', 'neutral', 'rest']

export interface Category {
  id: string
  name: string
  /** CSS colour, e.g. "#2563eb" */
  color: string
  /** Hidden categories stay on old entries but aren't offered for new ones. */
  hidden: boolean
  order: number
  /** How time on this counts in "productive hours". Older data without it reads as neutral. */
  kind: Kind
}

export interface Entry {
  id: string
  /** Local calendar date the entry starts on, "YYYY-MM-DD". */
  date: string
  /** "HH:MM", or null when only a duration was recorded. */
  start: string | null
  /** "HH:MM", or null when only a duration was recorded. Earlier than start = crosses midnight. */
  end: string | null
  minutes: number
  /** One or more activities done in this block. Totals share the time equally between them. */
  categoryIds: string[]
  tags: string[]
  note: string
  createdAt: string
  updatedAt: string
}
