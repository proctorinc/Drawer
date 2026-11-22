import type { FC, ReactNode } from 'react';
import { useUpcomingEvent } from '@/api/events';
import useAuth from '@/auth/hooks/useAuth';
import ComingSoonCard from '@/events/ComingSoonCard';

type Props = {
  /**
   * The card that sits beside the event preview. `compact` is true when it
   * shares the row and only gets a quarter of the width.
   */
  aside: (compact: boolean) => ReactNode;
};

/**
 * The standard event-preview layout: whenever an event is coming up, its
 * teaser takes three quarters of the row and the page's own card (e.g. the
 * next-prompt countdown) shrinks into the remaining quarter. With no event
 * coming, the aside renders on its own at full size.
 */
const EventPreviewRow: FC<Props> = ({ aside }) => {
  const { isAuthenticated } = useAuth();
  const { data: event } = useUpcomingEvent(isAuthenticated);

  if (!event) return <>{aside(false)}</>;

  return (
    <div className="grid grid-cols-[1fr_3fr] items-stretch gap-3 w-full">
      <div className="@container flex min-w-0">{aside(true)}</div>
      <ComingSoonCard compact className="min-w-0" />
    </div>
  );
};

export default EventPreviewRow;
