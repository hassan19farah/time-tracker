import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Line under the title: the full date or date range. */
  subtitle: string
  prevLabel: string
  nextLabel: string
  onPrev: () => void
  onNext: () => void
  /** Shown beside the subtitle when not on the current day/week. */
  backLabel?: string
  onBack?: () => void
  /** Optional wrapper for the title, e.g. a hidden date picker. */
  renderTitle?: (title: ReactNode) => ReactNode
}

/** ‹ Title › with a subtitle line. The same height on every tab, so content doesn't jump. */
export function PeriodNav({ title, subtitle, prevLabel, nextLabel, onPrev, onNext, backLabel, onBack, renderTitle }: Props) {
  const titleNode = <span className="day-label">{title}</span>
  return (
    <div className="period-nav">
      <div className="day-nav">
        <button type="button" className="icon-button" onClick={onPrev} aria-label={prevLabel}>
          ‹
        </button>
        {renderTitle ? renderTitle(titleNode) : <span className="day-picker">{titleNode}</span>}
        <button type="button" className="icon-button" onClick={onNext} aria-label={nextLabel}>
          ›
        </button>
      </div>
      <p className="nav-sub">
        <span className="muted">{subtitle}</span>
        {backLabel && onBack && (
          <>
            <span className="muted" aria-hidden="true">
              {' · '}
            </span>
            <button type="button" className="link-button inline" onClick={onBack}>
              {backLabel}
            </button>
          </>
        )}
      </p>
    </div>
  )
}
