import { useEffect } from 'react';
import { useActiveEvent } from '@/api/events';
import useAuth from '@/auth/hooks/useAuth';

const STORAGE_KEY = 'LOGO_THEME';

function readCached(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The live event's theme, for the logo. The event is only known once you're
 * signed in, so the last theme seen is remembered for the loading screen and
 * sign-in page.
 */
export function useLogoTheme(): string | null {
  const { isAuthenticated } = useAuth();
  const { data: event, isSuccess } = useActiveEvent(isAuthenticated);
  const live = isSuccess ? (event?.theme ?? null) : undefined;

  useEffect(() => {
    if (live === undefined) return;
    try {
      if (live) localStorage.setItem(STORAGE_KEY, live);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode or blocked storage: the logo just waits for the event
    }
  }, [live]);

  return live === undefined ? readCached() : live;
}
