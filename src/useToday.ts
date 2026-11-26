import { useEffect, useState } from 'react'
import { toISODate } from './time'

/** Today's date, refreshed every minute so "Today" stays right past midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setToday(toISODate(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  return today
}
