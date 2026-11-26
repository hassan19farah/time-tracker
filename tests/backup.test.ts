import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeBackup, parseBackup, planMerge } from '../src/backup.ts'
import type { Category, Entry } from '../src/types.ts'
import { normalizeKind } from '../src/types.ts'

const cat = (id: string, name: string, order: number, kind: Category['kind'] = 'necessary'): Category => ({
  id,
  name,
  color: '#2563eb',
  hidden: false,
  order,
  kind,
})
const entry = (id: string, categoryIds: string[], updatedAt = '2026-01-01T00:00:00.000Z'): Entry => ({
  id,
  date: '2026-11-25',
  start: '09:00',
  end: '10:00',
  minutes: 60,
  categoryIds,
  tags: ['t'],
  note: 'n',
  createdAt: updatedAt,
  updatedAt,
})

const fileCats = [cat('f-sleep', 'Sleep', 0, 'rest'), cat('f-gym', 'Gym', 1, 'productive')]
const fileEntries = [entry('e1', ['f-sleep']), entry('e2', ['f-gym', 'f-sleep'])]
const file = JSON.stringify(makeBackup(fileCats, fileEntries))

test('round trip: export then parse gives the same data', () => {
  const b = parseBackup(file)
  assert.deepEqual(b.categories, fileCats)
  assert.deepEqual(b.entries, fileEntries)
})

test('merge matches categories by name and never duplicates on re-import', () => {
  const current = { categories: [cat('g-sleep', 'sleep', 0, 'rest')], entries: [] as Entry[] }
  const plan = planMerge(current, parseBackup(file))
  assert.deepEqual(plan.categories.map((c) => c.name), ['Gym'])
  assert.equal(plan.summary.added, 2)
  assert.deepEqual(plan.entries[0].categoryIds, ['g-sleep'])
  const after = { categories: [...current.categories, ...plan.categories], entries: plan.entries }
  assert.deepEqual(planMerge(after, parseBackup(file)).summary, { newCategories: 0, added: 0, updated: 0, unchanged: 2 })
})

test('merge only replaces an entry when the file copy is newer', () => {
  const current = { categories: fileCats, entries: [entry('e1', ['f-sleep'], '2026-06-01T00:00:00.000Z')] }
  const s = planMerge(current, parseBackup(file)).summary
  assert.equal(s.unchanged, 1)
  assert.equal(s.added, 1)
})

test('older data: "neutral" and missing groups read as necessary', () => {
  assert.equal(normalizeKind('neutral'), 'necessary')
  assert.equal(normalizeKind(undefined), 'necessary')
  assert.equal(normalizeKind('rest'), 'rest')
  const old = JSON.parse(file)
  old.categories[0].kind = 'neutral'
  delete old.categories[1].kind
  assert.ok(parseBackup(JSON.stringify(old)).categories.every((c) => c.kind === 'necessary'))
})

test('bad files are rejected with a readable message', () => {
  assert.throws(() => parseBackup('nope'), /valid JSON/)
  assert.throws(() => parseBackup('{"app":"other"}'), /isn’t a Time Tracker backup/)
  const badTime = JSON.parse(file)
  badTime.entries[0].start = '25:00'
  assert.throws(() => parseBackup(JSON.stringify(badTime)), /Entry 1 has an invalid time/)
  const orphan = JSON.parse(file)
  orphan.entries[0].categoryIds = ['missing']
  assert.throws(() => parseBackup(JSON.stringify(orphan)), /isn’t in the file/)
  const noEnd = JSON.parse(file)
  noEnd.entries[0].end = null
  assert.throws(() => parseBackup(JSON.stringify(noEnd)), /start time without an end/)
})
