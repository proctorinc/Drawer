import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BellIcon, PencilIcon } from './icons';
import type { FC, ReactNode } from 'react';
import type { Activity, ActivityFeedResponse, ReactionId } from '@/api/Api';
import { queryKeys, useActivityFeed, useMarkActivityRead } from '@/api/Api';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn, timeAgo } from '@/utils';

const reactionVerbs: Record<ReactionId, string> = {
  heart: 'loved',
  'cry-laugh': 'cracked up at',
  fire: 'thinks this is fire:',
  'face-meh': 'shrugged at',
};

const ActivityText: FC<{ activity: Activity }> = ({ activity }) => {
  const name = <b className="font-bold">{activity.user.username}</b>;

  if (activity.action === 'poke') {
    return <>{name} poked you to draw</>;
  }
  if (activity.comment) {
    return (
      <>
        {name} said “{activity.comment.text}”
      </>
    );
  }
  return (
    <>
      {name} {reactionVerbs[activity.reaction?.reactionId ?? 'heart']} your{' '}
      <i>{withoutArticle(activity.submission?.prompt ?? '')}</i>
    </>
  );
};

/** "A goalie" → "goalie", so it reads "your goalie" */
const withoutArticle = (prompt: string) =>
  prompt.toLowerCase().replace(/^(a|an|the)\s+/, '');

const rowClass =
  'flex items-center gap-3 px-3 py-2.5 hover:bg-paper transition-colors';

/** Pokes open today's page; everything else opens the doodle it's on */
const ActivityLink: FC<{
  activity: Activity;
  className: string;
  onClick: () => void;
  children: ReactNode;
}> = ({ activity, ...props }) =>
  activity.submission ? (
    <Link
      to="/draw/submission/$submissionId"
      params={{ submissionId: activity.submission.id }}
      {...props}
    />
  ) : (
    <Link to="/draw" {...props} />
  );

const ActivityItem: FC<{ activity: Activity; onSelect: () => void }> = ({
  activity,
  onSelect,
}) => (
  <li>
    <ActivityLink
      activity={activity}
      onClick={onSelect}
      className={cn(rowClass, !activity.isRead && 'bg-butter/40')}
    >
      {/* The whole row is the link, so the avatar shouldn't catch the tap */}
      <UserProfileIcon
        user={activity.user}
        size="sm"
        className="flex-none pointer-events-none"
      />
      <div className="flex flex-col flex-grow min-w-0 leading-tight">
        <p className="line-clamp-2">
          <ActivityText activity={activity} />
        </p>
        <span className="flex items-center gap-1.5 text-sm text-pencil">
          {!activity.isRead && (
            <span className="size-2 bg-coral rounded-full" />
          )}
          {timeAgo(activity.date)}
        </span>
      </div>
      {activity.submission ? (
        <DrawingImage
          imageUrl={activity.submission.imageUrl}
          className="flex-none !size-12 bg-[#fff8ec] border-[1.5px] border-ink -rotate-2"
        />
      ) : (
        <span className="flex flex-none items-center justify-center size-12 bg-butter border-[1.5px] border-ink rotate-2">
          <PencilIcon size={22} className="animate-nudge" />
        </span>
      )}
    </ActivityLink>
  </li>
);

/** Masthead bell: counts reactions, comments and pokes you haven't seen, and opens a quick list of them */
const ActivityBell = () => {
  const queryClient = useQueryClient();
  const { data } = useActivityFeed();
  const markRead = useMarkActivityRead();
  const [open, setOpen] = useState(false);

  const activities = data?.activities ?? [];
  const unseen = activities.filter((activity) => !activity.isRead).length;

  function close() {
    setOpen(false);
    if (unseen === 0) return;
    // Clear the badge now; the server keeps it cleared on your other devices.
    // The server sends newest first.
    markRead.mutate(new Date(activities[0].date).toISOString());
    queryClient.setQueryData<ActivityFeedResponse>(
      queryKeys.activityFeed,
      (feed) =>
        feed && {
          ...feed,
          activities: feed.activities.map((activity) => ({
            ...activity,
            isRead: true,
          })),
        },
    );
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => event.key === 'Escape' && close()}
    >
      <button
        aria-label={unseen > 0 ? `${unseen} new on your doodles` : 'Activity'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="press relative flex flex-none items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm cursor-pointer"
      >
        <BellIcon
          size={22}
          className={cn(unseen > 0 && 'animate-wiggle origin-top')}
        />
        {unseen > 0 && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-5 h-5 px-1 bg-coral border-2 border-ink rounded-full text-xs font-bold leading-none animate-in zoom-in-0 duration-300">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40"
            onClick={close}
          />
          <div
            role="dialog"
            aria-label="Recent activity"
            className="absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-2.5rem))] max-h-[70dvh] overflow-y-auto bg-white border-2 border-ink rounded-sketch shadow-pencil origin-top-right animate-in fade-in zoom-in-95 duration-200"
          >
            <h2 className="px-3 pt-3 pb-1 font-accent font-bold text-2xl leading-none">
              on your doodles
            </h2>
            {activities.length === 0 ? (
              <p className="flex flex-col items-center gap-1 px-4 py-6 text-center text-pencil">
                <PencilIcon
                  size={32}
                  strokeWidth={1.6}
                  className="animate-nudge"
                />
                quiet in here. draw something and your friends will chime in!
              </p>
            ) : (
              <ul className="flex flex-col pb-1.5">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onSelect={close}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityBell;
