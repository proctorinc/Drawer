import { addDays, format } from 'date-fns';

/** YYYY-MM-DD, in the browser's time zone */
export const toDay = (date: Date) => format(date, 'yyyy-MM-dd');

export const dayAfter = (day: string, n = 1) =>
  toDay(addDays(new Date(`${day}T00:00:00`), n));

/** The first day from `from` on with no prompt, looking up to a year ahead */
export function nextOpenDay(taken: Set<string>, from: string) {
  return openDays(taken, from, 366)[0] as string | undefined;
}

/** The days in the `count` days starting at `from` that have no prompt */
export function openDays(taken: Set<string>, from: string, count: number) {
  return Array.from({ length: count }, (_, i) => dayAfter(from, i)).filter(
    (day) => !taken.has(day),
  );
}
