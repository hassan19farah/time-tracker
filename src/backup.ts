// Backup files: a JSON copy of all categories and entries that can be imported again,
// on this device or another one.
import { MINUTES_PER_DAY, minutesBetween, parseTime } from './time'
import type { Category, Entry } from './types'

export const BACKUP_APP = 'time-tracker'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  categories: Category[]
  entries: Entry[]
}

export function makeBackup(categories: Category[], entries: Entry[]): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories,
    entries,
  }
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `time-tracker-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isString = (v: unknown): v is string => typeof v === 'string'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COLOR_RE = /^#[0-9a-f]{6}$/i

/** Parses and checks a backup file. Throws an Error with a readable message if it's not valid. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file isn’t a Time Tracker backup (it isn’t valid JSON).')
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP) {
    throw new Error('This file isn’t a Time Tracker backup.')
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new Error(`This backup is format version ${String(raw.version)}, which this version of the app can’t read.`)
  }
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.entries)) {
    throw new Error('This backup is missing its categories or entries.')
  }

  const categories: Category[] = raw.categories.map((c: unknown, i: number) => {
    const where = `Category ${i + 1}`
    if (!isObject(c) || !isString(c.id) || !c.id || !isString(c.name) || !c.name.trim()) {
      throw new Error(`${where} is missing its id or name.`)
    }
    return {
      id: c.id,
      name: c.name.trim().slice(0, 40),
      color: isString(c.color) && COLOR_RE.test(c.color) ? c.color : '#78716c',
      hidden: c.hidden === true,
      order: typeof c.order === 'number' && Number.isFinite(c.order) ? c.order : i,
    }
  })
  const categoryIds = new Set(categories.map((c) => c.id))

  const entries: Entry[] = raw.entries.map((e: unknown, i: number) => {
    const where = `Entry ${i + 1}`
    if (!isObject(e) || !isString(e.id) || !e.id) throw new Error(`${where} is missing its id.`)
    if (!isString(e.date) || !DATE_RE.test(e.date)) throw new Error(`${where} has an invalid date.`)
    const start = e.start ?? null
    const end = e.end ?? null
    if ((start === null) !== (end === null)) throw new Error(`${where} has a start time without an end time.`)
    if (start !== null && (!isString(start) || !isString(end) || parseTime(start) === null || parseTime(end as string) === null)) {
      throw new Error(`${where} has an invalid time.`)
    }
    const minutes =
      start !== null ? minutesBetween(start as string, end as string) : typeof e.minutes === 'number' ? e.minutes : null
    if (minutes === null || !Number.isInteger(minutes) || minutes <= 0 || minutes > MINUTES_PER_DAY) {
      throw new Error(`${where} has an invalid duration.`)
    }
    if (!Array.isArray(e.categoryIds) || e.categoryIds.length === 0 || !e.categoryIds.every(isString)) {
      throw new Error(`${where} has no categories.`)
    }
    const missing = e.categoryIds.find((id) => !categoryIds.has(id))
    if (missing) throw new Error(`${where} uses a category that isn’t in the file.`)
    const now = new Date().toISOString()
    return {
      id: e.id,
      date: e.date,
      start: start as string | null,
      end: end as string | null,
      minutes,
      categoryIds: [...new Set(e.categoryIds)],
      tags: Array.isArray(e.tags) ? e.tags.filter(isString) : [],
      note: isString(e.note) ? e.note : '',
      createdAt: isString(e.createdAt) ? e.createdAt : now,
      updatedAt: isString(e.updatedAt) ? e.updatedAt : now,
    }
  })

  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: isString(raw.exportedAt) ? raw.exportedAt : '', categories, entries }
}

export interface MergePlan {
  categories: Category[]
  entries: Entry[]
  summary: { newCategories: number; added: number; updated: number; unchanged: number }
}

/**
 * Works out what to write when importing into existing data, without losing anything:
 * - categories match by id, then by name (so "Sleep" isn't duplicated), otherwise are added;
 * - entries are added, or replace an existing entry with the same id only if the backup's copy is newer.
 */
export function planMerge(current: { categories: Category[]; entries: Entry[] }, backup: BackupFile): MergePlan {
  const idMap = new Map<string, string>()
  const byId = new Map(current.categories.map((c) => [c.id, c]))
  const byName = new Map(current.categories.map((c) => [c.name.toLowerCase(), c]))
  let nextOrder = Math.max(-1, ...current.categories.map((c) => c.order)) + 1
  const newCategories: Category[] = []

  for (const c of [...backup.categories].sort((a, b) => a.order - b.order)) {
    const match = byId.get(c.id) ?? byName.get(c.name.toLowerCase())
    if (match) {
      idMap.set(c.id, match.id)
    } else {
      const added = { ...c, order: nextOrder++ }
      newCategories.push(added)
      byName.set(added.name.toLowerCase(), added)
      idMap.set(c.id, c.id)
    }
  }

  const existing = new Map(current.entries.map((e) => [e.id, e]))
  const entries: Entry[] = []
  let added = 0
  let updated = 0
  let unchanged = 0
  for (const e of backup.entries) {
    const mapped = { ...e, categoryIds: [...new Set(e.categoryIds.map((id) => idMap.get(id) ?? id))] }
    const old = existing.get(e.id)
    if (!old) {
      added++
      entries.push(mapped)
    } else if (e.updatedAt > old.updatedAt) {
      updated++
      entries.push(mapped)
    } else {
      unchanged++
    }
  }

  return { categories: newCategories, entries, summary: { newCategories: newCategories.length, added, updated, unchanged } }
}
