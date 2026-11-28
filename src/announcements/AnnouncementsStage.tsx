import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import AnnouncementArt from './AnnouncementArt';
import { useMarkAnnouncementsSeen } from './api';
import type { StageComponent } from '@/animations/types';
import type { Announcement } from './api';
import { PagedStage } from '@/animations/PagedStage';
import { useStageHost } from '@/animations/StageHost';
import { useStageExit } from '@/animations/completed/useStageExit';

/** The button's link: an in-app path navigates, anything else opens in a new tab */
function useFollow(onLeave: () => void, preview: boolean) {
  const navigate = useNavigate();
  return (a: Announcement) => {
    if (preview) return onLeave();
    if (a.ctaUrl.startsWith('/')) {
      void navigate({ to: a.ctaUrl });
    } else {
      window.open(a.ctaUrl, '_blank', 'noopener');
    }
    onLeave();
  };
}

/**
 * What's new, filling the screen: one page per announcement. Opening it
 * counts as reading every page, so they don't pop up on their own again (the
 * preview and replays from the bell aside).
 */
export const AnnouncementsStage: StageComponent<'announcements'> = ({
  payload,
  onDone,
}) => {
  const { preview } = useStageHost();
  const isPreview = preview || !!payload.preview;
  const { leaving, exit, finish } = useStageExit(onDone);
  const follow = useFollow(finish, isPreview);
  const announcements = payload.announcements;

  // Mark them seen as soon as they're up, so a reload mid-read doesn't pop them again
  const markSeen = useMarkAnnouncementsSeen();
  const marked = useRef(false);
  useEffect(() => {
    if (isPreview || marked.current || !payload.markSeen?.length) return;
    marked.current = true;
    markSeen.mutate(payload.markSeen);
  }, [isPreview, markSeen, payload.markSeen]);

  // Nothing to show: step aside
  useEffect(() => {
    if (announcements.length === 0) finish();
  }, [announcements.length, finish]);

  return (
    <PagedStage
      eyebrow="what's new"
      leaving={leaving}
      onClose={exit}
      pages={announcements.map((a) => ({
        id: a.id,
        art: <AnnouncementArt announcement={a} />,
        title: a.title,
        body: a.body
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, i) => (
            <p
              key={i}
              className="text-lg leading-snug text-pencil whitespace-pre-line"
            >
              {paragraph}
            </p>
          )),
        action: a.ctaUrl
          ? { label: a.ctaLabel, onClick: () => follow(a) }
          : undefined,
      }))}
    />
  );
};

export default AnnouncementsStage;
