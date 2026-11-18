import type { ActiveEvent } from '@/api/events';
import { useActiveEvent } from '@/api/events';
import useAuth from '@/auth/hooks/useAuth';

/** Theme of the live event, e.g. "christmas", or null outside events */
export function useEventTheme(): string | null {
  const { isAuthenticated } = useAuth();
  const { data: event } = useActiveEvent(isAuthenticated);
  return event?.theme ?? null;
}

/** The live event when it's the Christmas one, otherwise null */
export function useChristmas(): ActiveEvent | null {
  const { isAuthenticated } = useAuth();
  const { data: event } = useActiveEvent(isAuthenticated);
  return event?.theme === 'christmas' ? event : null;
}

/** Date line copy, e.g. "day 23 of 29" + "3 sleeps till christmas" */
export function countdownCopy(event: ActiveEvent) {
  const { dayNumber, countdownDays, daysUntilCountdownEnd } = event;
  if (countdownDays === null || dayNumber > countdownDays) {
    return { day: 'happy holidays', left: 'see your tree' };
  }
  if (daysUntilCountdownEnd === 0) {
    return {
      day: `day ${dayNumber} of ${countdownDays}`,
      left: 'merry christmas!',
    };
  }
  const sleeps = daysUntilCountdownEnd ?? 0;
  return {
    day: `day ${dayNumber} of ${countdownDays}`,
    left: `${sleeps} ${sleeps === 1 ? 'sleep' : 'sleeps'} till christmas`,
  };
}

/** YYYY-MM-DD for each countdown day, starting with the event's first */
export function countdownDates(event: ActiveEvent): Array<string> {
  const start = new Date(event.startsAt).getTime();
  return Array.from({ length: event.countdownDays ?? 0 }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** The house colors for event chrome, cycled across lights and ornaments */
export const XMAS_COLORS = ['#e5483b', '#2f9e5b', '#ffb400'];
