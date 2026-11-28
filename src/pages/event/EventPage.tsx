import { Link, useParams, useSearch } from '@tanstack/react-router';
import StandingsAndQuests from './StandingsAndQuests';
import type { FC, ReactNode } from 'react';
import type { ActiveEvent } from '@/api/events';
import { useGetAchievements, useGetRedos } from '@/api/Api';
import { useActiveEvent, useEventRecap } from '@/api/events';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { TrophyIcon } from '@/components/icons';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import ChristmasTree from '@/events/christmas/ChristmasTree';
import { ChristmasIntroButton } from '@/events/christmas/ChristmasIntro';
import EventBadge from '@/events/christmas/EventBadge';
import EventLeaderboard from '@/events/christmas/EventLeaderboard';
import EventStickers from '@/events/christmas/EventStickers';
import GrinchDays from '@/events/christmas/GrinchDays';
import { splitEventAchievements } from '@/events/christmas/eventAchievements';
import { EventXPInfo } from '@/events/EventXPCard';
import { countdownCopy } from '@/events/useChristmas';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import QuestList, {
  weekResetLabel,
} from '@/pages/trophies/components/QuestList';

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

/** ["day 23 of 29", "6 sleeps till christmas"] while live, the dates once it's over */
function status(event: ActiveEvent, isLive: boolean): [string, string] {
  if (isLive) {
    const copy = countdownCopy(event);
    return [copy.day, copy.left];
  }
  // endsAt is the moment it stopped, so the last day is the one before
  const lastDay = new Date(new Date(event.endsAt).getTime() - 86_400_000);
  return [
    `${shortDate(event.startsAt)} – ${shortDate(lastDay.toISOString())}`,
    'all wrapped up',
  ];
}

/**
 * One event, for you or a friend (?user=): live or long over, it's the same
 * page at /draw/event/<slug>, so past events stay worth revisiting.
 */
const EventPage = () => {
  const me = useUser();
  const { slug } = useParams({ from: '/_app/draw/event/$slug' });
  const { user: userParam } = useSearch({ from: '/_app/draw/event/$slug' });
  const viewingFriend = !!userParam && userParam !== me.id;
  const {
    data: recap,
    isLoading,
    isError,
    refetch,
  } = useEventRecap(slug, viewingFriend ? userParam : undefined);
  const { data: liveEvent } = useActiveEvent();
  const { data: achievements } = useGetAchievements();
  const { data: redos } = useGetRedos();

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

  const { event, submissions, user, xp, quests } = recap;
  const isLive = liveEvent?.slug === event.slug;
  // Stickers come from your own achievements, so they're only shown for you
  const { main: stickers, extras } = viewingFriend
    ? { main: [], extras: [] }
    : splitEventAchievements(achievements?.achievements ?? [], event.slug);
  const stickersEarned = [...stickers, ...extras].filter(
    (s) => s.achievedAt,
  ).length;
  const [day, left] = status(event, isLive);
  // Your missed days that can still be drawn, tapped open from their ornaments
  const redoDays =
    isLive && !viewingFriend
      ? new Set(redos?.prompts.map((p) => p.day.slice(0, 10)))
      : undefined;
  // Each doodle hangs on the tree on its own day
  const drawingsByDay = Object.fromEntries(
    submissions.map((s) => [
      s.day.slice(0, 10),
      { id: s.id, imageUrl: s.imageUrl, locked: s.locked },
    ]),
  );

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

      {event.countdownDays ? (
        // The title and status fill the empty corners beside the tree's tip
        <section className="relative flex flex-col items-center gap-2 w-full">
          <ChristmasTree
            event={event}
            drawings={drawingsByDay}
            grinchDays={recap.grinchDays}
            redoDays={redoDays}
          />
          <EventBadge
            days={event.countdownDays}
            className="absolute top-1 left-0 scale-[0.65] origin-top-left"
          />
          <div className="absolute top-0 right-0 flex flex-col items-end gap-1.5 max-w-[34%] text-right text-sm text-pencil leading-tight">
            <span>
              <b className="block font-accent font-bold text-xl text-ink leading-none">
                {day}
              </b>
              {left}
            </span>
            <span>
              {event.progress.count} of {event.countdownDays} hung
            </span>
            <EventXPInfo xp={xp} title="christmas XP" />
          </div>
          {liveEvent && isLive && !viewingFriend && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-pencil">
                every doodle you draw hangs on the tree
                {!!redos?.freeDays.length && (
                  <>
                    <br />
                    missed a day? tap its ornament to draw it now
                  </>
                )}
              </p>
              <ChristmasIntroButton event={liveEvent} />
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 w-full">
          <EventBadge days={event.dayNumber} />
          <p className="text-lg text-pencil text-center">
            {day} · {left}
          </p>
          <EventXPInfo xp={xp} title="christmas XP" />
          {liveEvent && isLive && !viewingFriend && (
            <ChristmasIntroButton event={liveEvent} />
          )}
        </section>
      )}

      {recap.grinchDays && <GrinchDays event={event} days={recap.grinchDays} />}

      {stickers.length > 0 && (
        <Section
          title="christmas stickers"
          aside={`${stickersEarned}/${stickers.length + extras.length} collected`}
        >
          <EventStickers stickers={stickers} extras={extras} />
        </Section>
      )}

      {/* Quests come only while the event is live, in place of the trophy page's */}
      {quests ? (
        <StandingsAndQuests
          standings={{
            label: 'standings',
            content: <EventLeaderboard slug={event.slug} />,
          }}
          quests={{
            label: 'quests',
            aside: <Chip>{weekResetLabel(quests.week.resetsAt)}</Chip>,
            content: <QuestList quests={quests.quests} />,
          }}
        />
      ) : (
        !viewingFriend && (
          <Section title="christmas standings">
            <EventLeaderboard slug={event.slug} />
          </Section>
        )
      )}

      {/* The trophies page is closed while the event runs */}
      {!viewingFriend && !isLive && (
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
