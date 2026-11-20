import { Fragment, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BellIcon, FriendsIcon, PencilIcon, TrophyIcon } from './icons';
import type { FC, ReactNode } from 'react';
import type { Activity, ActivityFeedResponse, User } from '@/api/Api';
import { queryKeys, useActivityFeed, useMarkActivityRead } from '@/api/Api';
import useAuth from '@/auth/hooks/useAuth';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import Badge from '@/pages/trophies/components/Badge';
import { getReaction } from '@/reactions/catalog';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { cn, timeAgo } from '@/utils';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { useAIDialogue, wasReviewShown } from '@/ai/AIDialogue';
import { formatScore } from '@/ai/score';
import { isMasterpiece } from '@/ai/Masterpiece';

const useIsMe = () => {
  const { user } = useAuth();
  return (other: User) => other.id === user?.id;
};

const Name: FC<{ user: User }> = ({ user }) => (
  <b className="font-bold">{user.username}</b>
);

/** "ann", "ann and bob", "ann, bob and cat", or "ann, bob and 3 others" */
const Names: FC<{ users: Array<User> }> = ({ users }) => {
  const shown = users.length > 3 ? users.slice(0, 2) : users;
  const others = users.length - shown.length;
  const parts = [
    ...shown.map((user) => <Name key={user.id} user={user} />),
    ...(others > 0 ? [`${others} others`] : []),
  ];
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (i === parts.length - 1 ? ' and ' : ', ')}
      {part}
    </Fragment>
  ));
};

/** "A goalie" → "goalie", so it reads "your goalie" */
const withoutArticle = (prompt: string) =>
  prompt.toLowerCase().replace(/^(a|an|the)\s+/, '');

/** One person's single kind of reaction gets its own verb ("loved"); a mix doesn't */
const reactionVerb = (activity: Activity) =>
  activity.users?.length === 1 && activity.reactionIds?.length === 1
    ? getReaction(activity.reactionIds[0]).verb
    : 'reacted to';

const ActivityText: FC<{ activity: Activity }> = ({ activity }) => {
  const isMe = useIsMe();
  const name = <Name user={activity.user} />;
  const names = <Names users={activity.users ?? [activity.user]} />;
  const count = activity.count ?? 1;
  const drawing = activity.submission && (
    <>
      {isMe(activity.submission.artist)
        ? 'your'
        : `${activity.submission.artist.username}'s`}{' '}
      <i>{withoutArticle(activity.submission.prompt)}</i>
    </>
  );

  switch (activity.action) {
    case 'poke':
      return <>{name} poked you to draw</>;
    case 'achievement':
      return (
        <>
          {isMe(activity.user) ? 'You' : name} earned{' '}
          <i>{activity.achievement?.name}</i>
        </>
      );
    case 'level_up':
      return <>You reached level {activity.level}!</>;
    case 'friend_request':
      return <>{name} sent you a friend request</>;
    case 'friend_accepted':
      return <>{name} accepted your friend request</>;
    case 'comment':
      return count === 1 ? (
        <>
          {names} commented on {drawing}: “{activity.comment?.text}”
        </>
      ) : (
        <>
          {names} left {count} comments on {drawing}
        </>
      );
    case 'reaction':
      return (
        <>
          {names} {reactionVerb(activity)} {drawing}
        </>
      );
    case 'ai_review':
      return (
        <>
          <b className="font-bold">{activity.aiReview?.judge.name}</b> judged{' '}
          {drawing}
          {activity.aiReview?.score != null &&
            `: ${formatScore(activity.aiReview.score)}/10`}
        </>
      );
    case 'comment_reaction':
      return (
        <>
          {names} {reactionVerb(activity)} your comment “
          {activity.comment?.text}”
        </>
      );
  }
};

const rowClass =
  'flex items-center gap-3 px-3 py-2.5 hover:bg-paper transition-colors';

/**
 * AI judges' reviews replay the judge's dialogue, comments and reactions open the doodle they're on, your own milestones open Trophies,
 * pokes open today's page, and everything else opens the other person's profile
 */
const ActivityLink: FC<{
  activity: Activity;
  className: string;
  onClick: () => void;
  children: ReactNode;
}> = ({ activity, ...props }) => {
  const isMe = useIsMe();

  // An AI judge's review plays its dialogue right here; that links on to the doodle
  if (activity.aiReview) {
    return (
      <button
        type="button"
        {...props}
        className={cn(props.className, 'w-full text-left cursor-pointer')}
      />
    );
  }
  if (activity.submission) {
    return (
      <Link
        to="/draw/submission/$submissionId"
        params={{ submissionId: activity.submission.id }}
        {...props}
      />
    );
  }
  if (activity.action === 'poke') {
    return <Link to="/draw" {...props} />;
  }
  if (isMe(activity.user)) {
    return <Link to="/draw/trophies" {...props} />;
  }
  return (
    <Link
      to="/draw/profile/$userId"
      params={{ userId: activity.user.id }}
      {...props}
    />
  );
};

/** A square sticker standing in for a doodle on rows that aren't about one */
const IconTile: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="flex flex-none items-center justify-center size-12 bg-butter border-[1.5px] border-ink rotate-2">
    {children}
  </span>
);

const ActivityThumbnail: FC<{ activity: Activity }> = ({ activity }) => {
  if (activity.achievement) {
    return (
      <Badge
        achievement={activity.achievement}
        className="flex-none size-12 rotate-2"
      />
    );
  }
  if (activity.submission) {
    const reactionId = activity.reactionIds?.[0];
    return (
      <span className="relative flex-none">
        <DrawingImage
          imageUrl={activity.submission.imageUrl}
          className={cn(
            '!size-12 bg-[#fff8ec] border-[1.5px] border-ink -rotate-2',
            // A perfect 10 wears a gold mat here too
            isMasterpiece(activity) && 'outline-[3px] outline-gold',
          )}
        />
        {/* The newest reaction, stuck on the corner of the doodle it's on */}
        {reactionId && (
          <ReactionSticker
            reactionId={reactionId}
            size={24}
            className="absolute -bottom-1.5 -left-2 rotate-[-10deg]"
          />
        )}
      </span>
    );
  }
  switch (activity.action) {
    case 'level_up':
      return (
        <IconTile>
          <TrophyIcon size={22} />
        </IconTile>
      );
    case 'friend_request':
    case 'friend_accepted':
      return (
        <IconTile>
          <FriendsIcon size={22} />
        </IconTile>
      );
    default:
      return (
        <IconTile>
          <PencilIcon size={22} className="animate-nudge" />
        </IconTile>
      );
  }
};

const ActivityItem: FC<{ activity: Activity; onSelect: () => void }> = ({
  activity,
  onSelect,
}) => {
  const { showReview } = useAIDialogue();
  const review = activity.aiReview;

  return (
    <li>
      <ActivityLink
        activity={activity}
        onClick={() => {
          onSelect();
          // The judge says its piece again, over your doodle blown up
          if (review) showReview(review, activity.submission);
        }}
        className={cn(rowClass, !activity.isRead && 'bg-butter/40')}
      >
        {/* The whole row is the link, so the avatar shouldn't catch the tap */}
        {review ? (
          <AIJudgeAvatar
            judge={review.judge}
            className="flex-none pointer-events-none"
          />
        ) : (
          <UserProfileIcon
            user={activity.user}
            size="sm"
            className="flex-none pointer-events-none"
          />
        )}
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
        <ActivityThumbnail activity={activity} />
      </ActivityLink>
    </li>
  );
};

/** Masthead bell: counts what's new for you (comments, reactions, AI judges' reviews, pokes, friend requests, achievements and level-ups), and opens a quick list of them */
const ActivityBell = () => {
  const queryClient = useQueryClient();
  const { data } = useActivityFeed();
  const markRead = useMarkActivityRead();
  const [open, setOpen] = useState(false);

  const activities = data?.activities ?? [];
  const unseen = activities.filter((activity) => !activity.isRead).length;

  // A judge that finished while you were away (say, the app was closed) says its
  // piece when you come back, once
  const { showReview } = useAIDialogue();
  const unheard = activities.find(
    (activity) =>
      activity.aiReview &&
      !activity.isRead &&
      !wasReviewShown(activity.aiReview.submissionId),
  );
  useEffect(() => {
    if (unheard?.aiReview) {
      showReview(unheard.aiReview, unheard.submission);
    }
  }, [unheard, showReview]);

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
        aria-label={unseen > 0 ? `${unseen} new for you` : 'Activity'}
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
              what's new
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
