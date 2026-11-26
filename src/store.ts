import { useCallback, useEffect, useState } from 'react'
import type { MergePlan } from './backup'
import { getAll, getMeta, putBatch, putMany, remove, requestPersistence, setMeta } from './db'
import type { Category, Entry, Kind } from './types'

export interface TrackerData {
  categories: Category[]
  entries: Entry[]
  /** ISO time of the last export, if any. */
  lastBackup: string | null
}

export function newId(): string {
  // randomUUID is missing on plain-http pages (e.g. testing on a phone over the LAN).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Generic on purpose: personal categories are added on the device, never in the code.
const STARTER_CATEGORIES: [name: string, color: string, kind: Kind][] = [
  ['Sleep', '#6366f1', 'rest'],
  ['Work', '#2563eb', 'productive'],
  ['Study', '#0d9488', 'productive'],
  ['Projects', '#0284c7', 'productive'],
  ['Exercise', '#65a30d', 'productive'],
  ['Meals', '#ea580c', 'neutral'],
  ['Leisure', '#db2777', 'neutral'],
  ['Family', '#e11d48', 'neutral'],
  ['Social', '#9333ea', 'neutral'],
  ['Travel', '#0891b2', 'neutral'],
  ['Errands', '#78716c', 'neutral'],
  ['Self-care', '#ca8a04', 'neutral'],
]

function starterCategories(): Category[] {
  return STARTER_CATEGORIES.map(([name, color, kind], order) => ({
    id: newId(),
    name,
    color,
    hidden: false,
    order,
    kind,
  }))
}

async function loadData(): Promise<TrackerData> {
  const [storedCategories, entries, seeded, lastBackup = null] = await Promise.all([
    getAll<Category>('categories'),
    getAll<Entry>('entries'),
    getMeta<boolean>('seeded'),
    getMeta<string>('lastBackup'),
  ])
  const categories = storedCategories.map((c) => ({ ...c, kind: c.kind ?? 'neutral' }))
  // Seed starter categories once only, so deleting them all doesn't bring them back.
  if (!seeded && categories.length === 0) {
    const starters = starterCategories()
    await putMany('categories', starters)
    await setMeta('seeded', true)
    return { categories: starters, entries, lastBackup }
  }
  return { categories, entries, lastBackup }
}

// Shared so React StrictMode's double effect run can't seed twice.
let loading: Promise<TrackerData> | null = null

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

export function useTrackerData() {
  const [data, setData] = useState<TrackerData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loading ??= loadData().finally(() => {
      loading = null
    })
    loading.then(
      (d) => {
        if (!cancelled) setData(d)
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      },
    )
    void requestPersistence()
    return () => {
      cancelled = true
    }
  }, [])

  const saveEntry = useCallback(async (entry: Entry) => {
    await putMany('entries', [entry])
    setData((d) => d && { ...d, entries: upsert(d.entries, entry) })
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    await remove('entries', id)
    setData((d) => d && { ...d, entries: d.entries.filter((e) => e.id !== id) })
  }, [])

  const saveCategory = useCallback(async (category: Category) => {
    await putMany('categories', [category])
    setData((d) => d && { ...d, categories: upsert(d.categories, category) })
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    await remove('categories', id)
    setData((d) => d && { ...d, categories: d.categories.filter((c) => c.id !== id) })
  }, [])

  const applyImport = useCallback(async (plan: MergePlan) => {
    await putBatch([
      { store: 'categories', values: plan.categories },
      { store: 'entries', values: plan.entries },
    ])
    setData((d) => {
      if (!d) return d
      let { categories, entries } = d
      for (const c of plan.categories) categories = upsert(categories, c)
      for (const e of plan.entries) entries = upsert(entries, e)
      return { ...d, categories, entries }
    })
  }, [])

  const markBackedUp = useCallback(async () => {
    const now = new Date().toISOString()
    await setMeta('lastBackup', now)
    setData((d) => d && { ...d, lastBackup: now })
  }, [])

  return { data, error, saveEntry, deleteEntry, saveCategory, deleteCategory, applyImport, markBackedUp }
}
