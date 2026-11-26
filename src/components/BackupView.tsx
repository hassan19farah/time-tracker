import { useRef, useState, type ChangeEvent } from 'react'
import { backupFileName, makeBackup, parseBackup, planMerge, type MergePlan } from '../backup'
import type { TrackerData } from '../store'

interface Props {
  data: TrackerData
  onImport: (plan: MergePlan) => Promise<void>
  onExported: () => Promise<void>
}

export function BackupView({ data, onImport, onExported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; plan: MergePlan } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function exportData() {
    setError(null)
    setMessage(null)
    const json = JSON.stringify(makeBackup(data.categories, data.entries), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    try {
      await onExported()
      setMessage(`Saved ${data.entries.length} entries to ${a.download}. Keep it somewhere safe, off this device too.`)
    } catch {
      // The file was still downloaded; only the "last backup" note failed to save.
    }
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('That file is too large to be a Time Tracker backup.')
      const backup = parseBackup(await file.text())
      setPending({ name: file.name, plan: planMerge(data, backup) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      await onImport(pending.plan)
      const { added, updated } = pending.plan.summary
      setMessage(`Imported: ${added} new and ${updated} updated entries.`)
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const last = data.lastBackup ? new Date(data.lastBackup) : null

  return (
    <section aria-label="Backup">
      <h2 className="section-title">Backup</h2>
      <p className="muted small">
        Your entries are stored only in this browser. Clearing site data, or losing this device, deletes them.
        Export a backup file regularly and keep a copy somewhere else.
      </p>

      <div className="card">
        <h3>Export</h3>
        <p className="small">
          {data.entries.length} entries, {data.categories.length} categories.
          <br />
          <span className="muted">
            Last backup: {last ? last.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}
          </span>
        </p>
        <button type="button" className="primary" onClick={exportData}>
          Download backup
        </button>
      </div>

      <div className="card">
        <h3>Import</h3>
        <p className="small muted">
          Adds entries from a backup file. Nothing is deleted. Categories with the same name are combined.
        </p>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={chooseFile} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
          Choose backup file…
        </button>

        {pending && (
          <div className="import-preview" role="status">
            <p className="small">
              <strong>{pending.name}</strong>
              <br />
              {pending.plan.summary.added} new entries, {pending.plan.summary.updated} updated,{' '}
              {pending.plan.summary.unchanged} already here. {pending.plan.summary.newCategories} new categories.
            </p>
            <div className="actions">
              <button type="button" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirmImport}
                disabled={busy || pending.plan.entries.length + pending.plan.categories.length === 0}
              >
                Import
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
