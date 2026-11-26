export interface Stat {
  label: string
  value: string
  /** Short extra shown after the value, e.g. "36%" or "of 24h". */
  detail?: string
}

/** A row of three headline figures, shared by the Day and Week views. */
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <span className="stat-label">{s.label}</span>
          <span className="stat-value">
            {s.value}
            {s.detail && <span className="stat-detail">{s.detail}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
