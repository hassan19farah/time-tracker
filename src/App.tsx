import { useState } from 'react'
import { BackupView } from './components/BackupView'
import { CategoriesView } from './components/CategoriesView'
import { DayView } from './components/DayView'
import { EntryForm } from './components/EntryForm'
import { useTrackerData } from './store'
import { toISODate } from './time'
import type { Entry } from './types'

type Tab = 'day' | 'categories' | 'backup'

export default function App() {
  const { data, error, saveEntry, deleteEntry, saveCategory, deleteCategory, applyImport, markBackedUp } =
    useTrackerData()
  const [tab, setTab] = useState<Tab>('day')
  const [day, setDay] = useState(() => toISODate(new Date()))
  // undefined = form closed, null = adding, Entry = editing
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Time Tracker</h1>
      </header>

      <main className="content">
        {error ? (
          <p className="error" role="alert">
            Couldn’t open your saved data: {error}
          </p>
        ) : !data ? (
          <p className="muted">Loading…</p>
        ) : tab === 'day' ? (
          <DayView day={day} setDay={setDay} categories={data.categories} entries={data.entries} onEdit={setEditing} />
        ) : tab === 'backup' ? (
          <BackupView data={data} onImport={applyImport} onExported={markBackedUp} />
        ) : (
          <CategoriesView
            categories={data.categories}
            entries={data.entries}
            onSave={saveCategory}
            onDelete={deleteCategory}
          />
        )}
      </main>

      {data && tab === 'day' && (
        <button type="button" className="fab primary" onClick={() => setEditing(null)}>
          + Add entry
        </button>
      )}

      <nav className="tab-bar" aria-label="Sections">
        {(
          [
            ['day', 'Day'],
            ['categories', 'Categories'],
            ['backup', 'Backup'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {data && editing !== undefined && (
        <EntryForm
          key={editing?.id ?? 'new'}
          entry={editing}
          day={day}
          categories={data.categories}
          entries={data.entries}
          onSave={async (entry) => {
            await saveEntry(entry)
            setDay(entry.date)
          }}
          onDelete={deleteEntry}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
