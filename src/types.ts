export type Kind = 'productive' | 'necessary' | 'unproductive' | 'rest'

/** Also the order the groups are stacked and listed in. */
export const KINDS: Kind[] = ['productive', 'necessary', 'unproductive', 'rest']

export const KIND_LABEL: Record<Kind, string> = {
  productive: 'Productive',
  necessary: 'Necessary',
  unproductive: 'Unproductive',
  rest: 'Rest',
}

/** Reads groups from stored data or backups. Early versions used "neutral" for necessary. */
export function normalizeKind(value: unknown): Kind {
  if (value === 'neutral') return 'necessary'
  return KINDS.includes(value as Kind) ? (value as Kind) : 'necessary'
}

export interface Category {
  id: string
  name: string
  /** CSS colour, e.g. "#2563eb" */
  color: string
  /** Hidden categories stay on old entries but aren't offered for new ones. */
  hidden: boolean
  order: number
  /** Which group time on this counts towards (productive, necessary, unproductive or rest). */
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
