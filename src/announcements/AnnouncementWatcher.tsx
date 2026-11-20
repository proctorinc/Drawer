import { useCallback, useEffect, useRef } from 'react';
import { useAnnouncements } from './api';
import type { FC } from 'react';
import type { Announcement } from './api';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import useAuth from '@/auth/hooks/useAuth';

/** Plays announcements full screen, behind whatever celebration is already up */
export function useShowAnnouncements() {
  const { enqueue } = useAnimationQueue();
  return useCallback(
    (
      announcements: Array<Announcement>,
      options: { markSeen?: Array<string>; preview?: boolean } = {},
    ) => {
      if (announcements.length === 0) return;
      void enqueue({
        // Unique, so a replay never merges into one that's already queued
        id: `announcements-${Date.now()}`,
        kind: 'announcements',
        payload: { announcements, ...options },
      });
    },
    [enqueue],
  );
}

const Watcher: FC = () => {
  const { data } = useAnnouncements();
  const show = useShowAnnouncements();
  const shown = useRef(false);

  useEffect(() => {
    if (!data || shown.current) return;
    const unseen = data.filter((a) => !a.seen);
    if (unseen.length === 0) return;
    shown.current = true;
    show(unseen, { markSeen: unseen.map((a) => a.id) });
  }, [data, show]);

  return null;
};

/**
 * Pops up the announcements you haven't seen yet, once, when you open the app.
 * Mount once, inside the animation queue's provider; renders nothing.
 */
const AnnouncementWatcher: FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  // Keyed so switching accounts (or impersonating) checks again
  return <Watcher key={user.id} />;
};

export default AnnouncementWatcher;
