// Run with: npm test (Node's built-in test runner; no extra packages).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addDays,
  blockKind,
  dayLabel,
  findOverlaps,
  formatDuration,
  formatTime,
  minutesBetween,
  minutesByCategory,
  minutesByKind,
  parseTags,
  startOfWeek,
} from '../src/time.ts'

test('minutesBetween handles normal ranges, midnight and bad input', () => {
  assert.equal(minutesBetween('09:00', '10:00'), 60)
  assert.equal(minutesBetween('23:00', '01:00'), 120)
  assert.equal(minutesBetween('22:00', '00:00'), 120)
  assert.equal(minutesBetween('10:00', '10:00'), null)
  assert.equal(minutesBetween('25:00', '10:00'), null)
})

test('formatting', () => {
  assert.equal(formatDuration(90), '1h 30m')
  assert.equal(formatDuration(45), '45m')
  assert.equal(formatDuration(120), '2h')
  assert.equal(formatTime(1500), '01:00')
})

test('dates', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(dayLabel('2026-11-26', '2026-11-26'), 'Today')
  assert.equal(dayLabel('2026-11-25', '2026-11-26'), 'Yesterday')
  assert.equal(startOfWeek('2026-11-26'), '2026-11-23') // Thursday -> Monday
  assert.equal(startOfWeek('2026-11-23'), '2026-11-23') // Monday
  assert.equal(startOfWeek('2026-11-29'), '2026-11-23') // Sunday -> previous Monday
})

test('findOverlaps across midnight, touching edges and itself', () => {
  const e = (id: string, date: string, start: string | null, minutes: number) => ({ id, date, start, minutes })
  const list = [e('a', '2026-11-24', '23:00', 120), e('b', '2026-11-25', '09:00', 60), e('c', '2026-11-25', null, 60)]
  assert.deepEqual(findOverlaps(e('x', '2026-11-25', '00:30', 30), list).map((x) => x.id), ['a'])
  assert.deepEqual(findOverlaps(e('x', '2026-11-25', '10:00', 60), list), [])
  assert.deepEqual(findOverlaps(e('b', '2026-11-25', '09:30', 60), list), [])
})

test('parseTags trims, strips # and removes duplicates', () => {
  assert.deepEqual(parseTags('Deep work, #focus, deep work, ,'), ['Deep work', 'focus'])
})

test('a block with several categories shares its time equally', () => {
  const totals = minutesByCategory([{ minutes: 60, categoryIds: ['a', 'b'] }, { minutes: 30, categoryIds: ['a'] }])
  assert.equal(totals.get('a'), 60)
  assert.equal(totals.get('b'), 30)
})

test('group rule: productive, then unproductive, then necessary; rest only if all rest', () => {
  const kinds: Record<string, 'productive' | 'necessary' | 'unproductive' | 'rest'> = {
    work: 'productive',
    errand: 'necessary',
    meal: 'necessary',
    tv: 'unproductive',
    sleep: 'rest',
  }
  const kindOf = (id: string) => kinds[id]
  assert.equal(blockKind(['errand', 'work'], kindOf), 'productive')
  assert.equal(blockKind(['meal', 'tv'], kindOf), 'unproductive')
  assert.equal(blockKind(['tv', 'work'], kindOf), 'productive')
  assert.equal(blockKind(['errand'], kindOf), 'necessary')
  assert.equal(blockKind(['sleep', 'errand'], kindOf), 'necessary')
  assert.equal(blockKind(['sleep'], kindOf), 'rest')
  assert.equal(blockKind(['deleted'], kindOf), 'necessary')
  assert.deepEqual(
    minutesByKind([{ minutes: 60, categoryIds: ['meal', 'tv'] }, { minutes: 120, categoryIds: ['sleep'] }], kindOf),
    { productive: 0, necessary: 0, unproductive: 60, rest: 120 },
  )
})
