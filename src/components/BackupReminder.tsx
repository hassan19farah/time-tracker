import { useState } from 'react'

interface Props {
  lastBackup: string | null
  entryCount: number
  onBackUp: () => void
}

const REMIND_AFTER_DAYS = 7
const SNOOZE_KEY = 'tt-backup-snoozed-until'

function readSnooze(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

/** A gentle nudge to export, shown when there's data and no backup in the last week. */
export function BackupReminder({ lastBackup, entryCount, onBackUp }: Props) {
  const [snoozedUntil, setSnoozedUntil] = useState(readSnooze)
  const [now] = useState(() => Date.now())

  const daysSince = lastBackup ? Math.floor((now - new Date(lastBackup).getTime()) / 86_400_000) : null
  const due = entryCount > 0 && (daysSince === null || daysSince >= REMIND_AFTER_DAYS)
  if (!due || now < snoozedUntil) return null

  function snooze() {
    const until = now + 86_400_000
    setSnoozedUntil(until)
    try {
      localStorage.setItem(SNOOZE_KEY, String(until))
    } catch {
      // Private mode etc.: the reminder just comes back next time.
    }
  }

  return (
    <div className="reminder" role="status">
      <p>
        {daysSince === null
          ? 'You haven’t backed up your entries yet.'
          : `Your last backup was ${daysSince} days ago.`}{' '}
        They’re only stored in this browser.
      </p>
      <div className="actions">
        <button type="button" className="small-button" onClick={snooze}>
          Remind me tomorrow
        </button>
        <button type="button" className="small-button primary" onClick={onBackUp}>
          Back up now
        </button>
      </div>
    </div>
  )
}
