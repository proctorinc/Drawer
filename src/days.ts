/**
 * A prompt's `day` ("2026-11-18", sometimes with a UTC time after it) as local
 * midnight. `new Date(day)` would read it as UTC and land on the previous
 * evening for anyone west of Greenwich.
 */
export function parseDay(day: string): Date {
  const [year, month, date] = day.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** Months since year 0, so two dates can be compared month by month */
export function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}
