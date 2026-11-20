import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/api/apiClient';

/** The pictures an announcement can show (server: models.AnnouncementArts) */
export const ANNOUNCEMENT_ARTS = [
  'none',
  'ai_judges',
  'christmas',
  'image',
] as const;
export type AnnouncementArt = (typeof ANNOUNCEMENT_ARTS)[number];

export interface Announcement {
  id: string;
  title: string;
  /** Plain text; blank lines split paragraphs */
  body: string;
  art: AnnouncementArt;
  imageUrl: string;
  /** An optional button: an in-app path (/draw/…) or an https:// link */
  ctaLabel: string;
  ctaUrl: string;
  /** Lower shows first */
  position: number;
  active: boolean;
  /** ISO timestamps; expiresAt is exclusive */
  startsAt: string;
  expiresAt: string;
}

/** A live announcement as you get it */
export interface PlayerAnnouncement extends Announcement {
  /** You've already seen it, so it won't pop up on its own again */
  seen: boolean;
}

export const announcementKeys = {
  live: ['announcements'] as const,
};

/** The announcements live right now, in the order they're shown */
export function useAnnouncements(enabled = true) {
  return useQuery({
    queryKey: announcementKeys.live,
    queryFn: async (): Promise<Array<PlayerAnnouncement>> => {
      const response = await fetchAPI('GET', '/announcements');
      if (!response.ok) throw new Error('Failed to load announcements');
      return (await response.json()).announcements;
    },
    enabled,
    staleTime: 10 * 60_000,
    // Nice to have: never worth a retry storm
    retry: false,
  });
}

/** Records that you've seen these, so they don't pop up on their own again */
export function useMarkAnnouncementsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: Array<string>) => {
      const response = await fetchAPI('POST', '/announcements/seen', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error('Failed to mark announcements seen');
    },
    onMutate: (ids) => {
      queryClient.setQueryData<Array<PlayerAnnouncement>>(
        announcementKeys.live,
        (list) =>
          list?.map((a) => (ids.includes(a.id) ? { ...a, seen: true } : a)),
      );
    },
  });
}
