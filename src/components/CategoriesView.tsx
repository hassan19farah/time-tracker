import { useState, type FormEvent } from 'react'
import { newId } from '../store'
import type { Category, Entry } from '../types'

interface Props {
  categories: Category[]
  entries: Entry[]
  onSave: (category: Category) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const NEW_COLORS = ['#2563eb', '#059669', '#ea580c', '#9333ea', '#db2777', '#ca8a04', '#0284c7', '#65a30d']

export function CategoriesView({ categories, entries, onSave, onDelete }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sorted = [...categories].sort((a, b) => a.order - b.order)
  const usage = new Map<string, number>()
  for (const e of entries) for (const id of e.categoryIds) usage.set(id, (usage.get(id) ?? 0) + 1)

  const isDuplicate = (n: string, exceptId?: string) =>
    categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase())

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (isDuplicate(trimmed)) return setError(`“${trimmed}” already exists.`)
    await run(async () => {
      await onSave({
        id: newId(),
        name: trimmed,
        color: NEW_COLORS[categories.length % NEW_COLORS.length],
        hidden: false,
        order: Math.max(-1, ...categories.map((c) => c.order)) + 1,
      })
      setName('')
    })
  }

  return (
    <section aria-label="Categories">
      <h2 className="section-title">Categories</h2>
      <p className="muted small">
        Hidden categories stay on past entries but aren’t offered for new ones. A category can only be deleted
        once no entries use it.
      </p>

      <ul className="category-list">
        {sorted.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            count={usage.get(c.id) ?? 0}
            isDuplicate={(n) => isDuplicate(n, c.id)}
            onSave={(next) => run(() => onSave(next))}
            onDelete={() => run(() => onDelete(c.id))}
            onError={setError}
          />
        ))}
      </ul>

      <form className="add-category" onSubmit={add}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          maxLength={40}
        />
        <button type="submit" className="primary" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

interface RowProps {
  category: Category
  count: number
  isDuplicate: (name: string) => boolean
  onSave: (category: Category) => Promise<void>
  onDelete: () => Promise<void>
  onError: (message: string) => void
}

function CategoryRow({ category, count, isDuplicate, onSave, onDelete, onError }: RowProps) {
  const [name, setName] = useState(category.name)

  function commitName() {
    const trimmed = name.trim()
    if (trimmed === category.name) return
    if (!trimmed || isDuplicate(trimmed)) {
      onError(trimmed ? `“${trimmed}” already exists.` : 'A category needs a name.')
      setName(category.name)
      return
    }
    void onSave({ ...category, name: trimmed })
  }

  return (
    <li className={category.hidden ? 'category-row is-hidden' : 'category-row'}>
      <input
        type="color"
        value={category.color}
        onChange={(e) => void onSave({ ...category, color: e.target.value })}
        aria-label={`Colour for ${category.name}`}
      />
      <input
        type="text"
        className="category-name"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Category name"
      />
      <span className="muted small count">{count}</span>
      <button type="button" className="small-button" onClick={() => void onSave({ ...category, hidden: !category.hidden })}>
        {category.hidden ? 'Show' : 'Hide'}
      </button>
      <button
        type="button"
        className="small-button danger"
        disabled={count > 0}
        title={count > 0 ? `Used by ${count} entr${count === 1 ? 'y' : 'ies'}` : undefined}
        onClick={() => confirm(`Delete “${category.name}”?`) && void onDelete()}
        aria-label={`Delete ${category.name}`}
      >
        Delete
      </button>
    </li>
  )
}
