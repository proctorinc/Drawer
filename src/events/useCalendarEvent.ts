import type { ActiveEvent, UpcomingEvent } from '@/api/events';
import { useActiveEvent, useUpcomingEvent } from '@/api/events';
import useAuth from '@/auth/hooks/useAuth';

const DAY_MS = 86_400_000;

export interface CalendarEvent {
  name: string;
  theme: string;
  /** YYYY-MM-DD for every day the event marks on the calendar, ascending */
  days: Array<string>;
}

/**
 * The days an event marks: its countdown when it has one (the 29 doodles of
 * Christmas), otherwise every day from its start up to its end.
 */
export function eventDays(
  event: Pick<ActiveEvent | UpcomingEvent, 'startsAt' | 'endsAt'> & {
    countdownDays: number | null;
  },
): Array<string> {
  const start = new Date(event.startsAt).getTime();
  const length =
    event.countdownDays ??
    Math.ceil((new Date(event.endsAt).getTime() - start) / DAY_MS);
  return Array.from({ length: Math.max(0, length) }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
}

/** The live event, or failing that the one about to start, for the calendar */
export function useCalendarEvent(): CalendarEvent | null {
  const { isAuthenticated } = useAuth();
  const { data: active } = useActiveEvent(isAuthenticated);
  const { data: upcoming } = useUpcomingEvent(isAuthenticated && !active);
  const event = active ?? upcoming;
  if (!event) return null;
  return { name: event.name, theme: event.theme, days: eventDays(event) };
}
