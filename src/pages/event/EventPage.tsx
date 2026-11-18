import { Link, useParams, useSearch } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import type { ActiveEvent } from '@/api/events';
import { useGetAchievements } from '@/api/Api';
import { useActiveEvent, useEventRecap } from '@/api/events';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { TrophyIcon } from '@/components/icons';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import ChristmasTree from '@/events/christmas/ChristmasTree';
import EventBadge from '@/events/christmas/EventBadge';
import EventLeaderboard from '@/events/christmas/EventLeaderboard';
import EventSticker from '@/events/christmas/EventSticker';
import { countdownCopy } from '@/events/useChristmas';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

const Section: FC<{
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}> = ({ title, aside, children }) => (
  <section className="flex flex-col gap-3 w-full">
    <div className="flex items-end justify-between gap-2">
      <h2 className="font-accent font-bold text-[28px] leading-none">
        {title}
      </h2>
      {aside && <span className="text-pencil">{aside}</span>}
    </div>
    {children}
  </section>
);

const shortDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .toLowerCase();

/** "day 23 of 29 · 6 sleeps till christmas" while live, the dates once it's over */
function statusLine(event: ActiveEvent, isLive: boolean) {
  if (isLive) {
    const copy = countdownCopy(event);
    return `${copy.day} · ${copy.left}`;
  }
  // endsAt is the moment it stopped, so the last day is the one before
  const lastDay = new Date(new Date(event.endsAt).getTime() - 86_400_000);
  return `${shortDate(event.startsAt)} – ${shortDate(lastDay.toISOString())} · all wrapped up`;
}

/**
 * One event, for you or a friend (?user=): live or long over, it's the same
 * page at /draw/event/<slug>, so past events stay worth revisiting.
 */
const EventPage = () => {
  const me = useUser();
  const { slug } = useParams({ from: '/draw/event/$slug' });
  const { user: userParam } = useSearch({ from: '/draw/event/$slug' });
  const viewingFriend = !!userParam && userParam !== me.id;
  const {
    data: recap,
    isLoading,
    isError,
    refetch,
  } = useEventRecap(slug, viewingFriend ? userParam : undefined);
  const { data: liveEvent } = useActiveEvent();
  const { data: achievements } = useGetAchievements();

  if (isLoading) return <LoadingScreen />;

  if (isError || !recap) {
    return (
      <Layout back>
        <p className="text-center text-pencil">
          Couldn't find this event. It may have melted.
        </p>
        <Button variant="base" size="sm" onClick={() => refetch()}>
          try again
        </Button>
      </Layout>
    );
  }

  const { event, stats, submissions, user } = recap;
  const isLive = liveEvent?.slug === event.slug;
  // Stickers come from your own achievements, so they're only shown for you
  const stickers = viewingFriend
    ? []
    : (achievements?.achievements.filter((a) => a.eventSlug === event.slug) ??
      []);
  const stickersEarned = stickers.filter((s) => s.achievedAt).length;
  const whose = viewingFriend ? `${user.username}'s` : 'your';

  return (
    <Layout back={viewingFriend || !isLive}>
      {viewingFriend && (
        <div className="flex items-center gap-3 self-start">
          <UserProfileIcon user={user} size="lg" />
          <h1 className="font-accent font-bold text-[30px] leading-none">
            {user.username}'s christmas
          </h1>
        </div>
      )}

      <section className="flex flex-col items-center gap-3 w-full">
        <EventBadge days={event.countdownDays ?? event.dayNumber} />
        <p className="text-lg text-pencil text-center">
          {statusLine(event, isLive)}
        </p>
      </section>

      <div className="grid grid-cols-3 gap-3 w-full stagger">
        {[
          { value: stats.doodles, label: 'doodles' },
          { value: stats.reactionsReceived, label: 'reactions' },
          { value: stats.longestStreak, label: 'best streak' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center py-2 bg-white border-[1.5px] border-ink rounded-sketch-alt"
          >
            <span className="font-accent font-bold text-3xl leading-none">
              {stat.value}
            </span>
            <span className="text-pencil">{stat.label}</span>
          </div>
        ))}
      </div>

      {event.countdownDays && (
        <Section
          title={`${whose} tree`}
          aside={`${event.progress.count} of ${event.countdownDays} ornaments`}
        >
          <ChristmasTree event={event} className="self-center" />
          {isLive && !viewingFriend && (
            <p className="-mt-1 text-center text-pencil">
              every doodle hangs another ornament
            </p>
          )}
        </Section>
      )}

      {stickers.length > 0 && (
        <Section
          title="christmas stickers"
          aside={`${stickersEarned}/${stickers.length} collected`}
        >
          <ul className="flex justify-around gap-2 w-full p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil stagger">
            {stickers.map((sticker) => (
              <li
                key={sticker.id}
                className="flex flex-col items-center gap-1 w-24 text-center text-sm leading-tight"
              >
                <EventSticker
                  achievement={sticker}
                  locked={!sticker.achievedAt}
                  className="w-12 h-13"
                />
                <span className={sticker.achievedAt ? '' : 'text-pencil'}>
                  {sticker.name}
                </span>
                {!sticker.achievedAt && (
                  <span className="text-xs text-pencil">
                    {Math.min(sticker.progress, sticker.achievementValue)}/
                    {sticker.achievementValue}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {submissions.length > 0 && (
        <Section
          title={`${whose} doodles`}
          aside={`${submissions.length} drawn`}
        >
          <div className="grid grid-cols-4 gap-2 w-full">
            {submissions.map((submission, i) => (
              <Link
                key={submission.id}
                to="/draw/submission/$submissionId"
                params={{ submissionId: submission.id }}
                aria-label={submission.prompt}
                className="p-1 bg-white border-[1.5px] border-ink animate-drop transition-[rotate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:scale-110"
                style={{
                  rotate: `${((i * 37) % 7) - 3}deg`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <DrawingImage
                  imageUrl={submission.imageUrl}
                  draggable={false}
                />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {!viewingFriend && (
        <Section title="christmas standings" aside="doodles drawn">
          <EventLeaderboard slug={event.slug} />
        </Section>
      )}

      {!viewingFriend && (
        <Link
          to="/draw/trophies"
          className="flex items-center justify-center gap-2 w-full pt-4 border-t-2 border-dashed border-line font-accent font-bold text-xl text-pencil hover:text-ink transition-colors"
        >
          <TrophyIcon size={20} />
          your year-round trophies →
        </Link>
      )}
    </Layout>
  );
};

export default EventPage;
