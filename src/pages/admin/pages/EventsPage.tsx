import { Fragment, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useAdminAchievements,
  useAdminEvents,
  useAdminSubmissions,
} from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  Tag,
  formatDay,
  td,
  th,
} from '../components/ui';
import EventReport from '../components/EventReport';
import type { AdminEvent } from '../api';
import type { FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import EventIcon from '@/events/EventIcon';
import LogoIcon from '@/components/logo/LogoIcon';
import ChristmasTree from '@/events/christmas/ChristmasTree';
import EventBadge from '@/events/christmas/EventBadge';
import Lights from '@/events/christmas/Lights';
import OrnamentTally from '@/events/christmas/OrnamentTally';
import Snowfall from '@/events/christmas/Snowfall';
import { countdownCopy, countdownDates } from '@/events/useChristmas';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import Badge from '@/pages/trophies/components/Badge';

const DAY = 86_400_000;

function status(event: AdminEvent, now = Date.now()) {
  if (now < new Date(event.startsAt).getTime()) return 'upcoming';
  if (now < new Date(event.endsAt).getTime()) return 'live';
  return 'ended';
}

const STATUS_COLORS = {
  upcoming: 'bg-sky',
  live: 'bg-butter',
  ended: 'bg-paper',
};

/**
 * The event as the app would show it on a given day, for someone who drew on
 * the share of days given by `drawnEvery` (1 = every day, 2 = every other day)
 */
function simulate(
  event: AdminEvent,
  dayNumber: number,
  drawnEvery: number,
): ActiveEvent {
  const fake: ActiveEvent = {
    ...event,
    dayNumber,
    countdownDays: event.countdownDays,
    daysUntilCountdownEnd:
      event.countdownDays === null
        ? null
        : Math.max(0, event.countdownDays - dayNumber),
    progress: { doodledDays: [], count: 0 },
  };
  const doodledDays = countdownDates(fake).filter(
    (_, i) => i < dayNumber && i % drawnEvery === 0,
  );
  return { ...fake, progress: { doodledDays, count: doodledDays.length } };
}

/** Every piece of Christmas chrome, driven by a pretend day and streak */
const ChristmasDemo: FC<{ event: AdminEvent }> = ({ event }) => {
  const totalDays = Math.round(
    (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) /
      DAY,
  );
  const [dayNumber, setDayNumber] = useState(
    Math.min(event.countdownDays ?? totalDays, 12),
  );
  const [drawnEvery, setDrawnEvery] = useState(1);
  const submissions = useAdminSubmissions().data ?? [];

  const simulated = simulate(event, dayNumber, drawnEvery);
  // Hang real doodles on the ornaments so the tree looks lived in
  const drawings = Object.fromEntries(
    simulated.progress.doodledDays.map((day, i) => [
      day,
      submissions.length ? submissions[i % submissions.length] : undefined,
    ]),
  );
  const copy = countdownCopy(simulated);

  return (
    <Panel className="flex flex-col gap-6 p-5">
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-3">
          pretend it's day
          <input
            type="range"
            min={1}
            max={totalDays}
            value={dayNumber}
            onChange={(e) => setDayNumber(Number(e.target.value))}
            className="w-56 accent-[var(--color-xmas-red)]"
          />
          <b className="w-8">{dayNumber}</b>
        </label>
        <label className="flex items-center gap-3">
          drew
          <select
            value={drawnEvery}
            onChange={(e) => setDrawnEvery(Number(e.target.value))}
            className="px-2 py-1 bg-white border-2 border-ink rounded-sketch-alt"
          >
            <option value={1}>every day</option>
            <option value={2}>every other day</option>
            <option value={3}>every third day</option>
          </select>
        </label>
        <span className="text-pencil">
          masthead reads: <b>{copy.day}</b> · <b>{copy.left}</b>
        </span>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            <LogoIcon theme={event.theme} size={64} animateScribble />
            <LogoIcon theme={null} size={64} />
            <span className="text-pencil">themed logo vs everyday logo</span>
          </div>
          {/* translate-z traps Snowfall's position:fixed inside this box */}
          <div className="relative h-48 overflow-hidden border-2 border-ink rounded-sketch bg-paper [transform:translateZ(0)]">
            <Snowfall />
            <Lights className="-mt-1.5" />
            <p className="absolute bottom-3 left-4 text-pencil">
              page chrome: lights and snowfall
            </p>
          </div>
          <div className="flex items-start gap-8">
            {event.countdownDays !== null && (
              <EventBadge days={event.countdownDays} />
            )}
            <OrnamentTally event={simulated} className="flex-1" />
          </div>
        </div>
        <ChristmasTree event={simulated} drawings={drawings} />
      </div>
    </Panel>
  );
};

/** Theme demos by event theme; themes without one show only their details */
const THEME_DEMOS: Record<string, FC<{ event: AdminEvent }> | undefined> = {
  christmas: ChristmasDemo,
};

const EventsPage = () => {
  const events = useAdminEvents();
  const achievements = useAdminAchievements().data ?? [];

  return (
    <AdminPage
      title="events"
      subtitle="limited-time events: how each went for everyone, its prompts, and a theme demo"
    >
      <Loaded query={events}>
        {(list) => (
          <>
            <Table
              head={
                <>
                  <th className={th}>event</th>
                  <th className={th}>status</th>
                  <th className={th}>runs</th>
                  <th className={th}>countdown</th>
                  <th className={th}>reactions</th>
                  <th className={th}>stickers</th>
                  <th className={th} />
                </>
              }
            >
              {list.map((event) => {
                const state = status(event);
                const stickers = achievements.filter(
                  (a) => a.eventSlug === event.slug,
                );
                return (
                  <tr key={event.id}>
                    <td className={td}>
                      <Link
                        to="/draw/event/$slug"
                        params={{ slug: event.slug }}
                        className="flex items-center gap-2 font-bold underline"
                      >
                        <EventIcon
                          theme={event.theme}
                          name={event.name}
                          size={24}
                        />
                        {event.name}
                      </Link>
                      <div className="font-mono text-xs text-pencil">
                        {event.slug} · {event.theme}
                      </div>
                    </td>
                    <td className={td}>
                      <Tag className={STATUS_COLORS[state]}>{state}</Tag>
                    </td>
                    <td className={td}>
                      {formatDay(event.firstDay)} → {formatDay(event.lastDay)}
                    </td>
                    <td className={td}>
                      {event.countdownDays
                        ? `${event.countdownDays} days`
                        : '–'}
                    </td>
                    <td className={td}>
                      <span className="flex gap-1">
                        {event.reactions.map((id) => (
                          <ReactionSticker key={id} reactionId={id} size={24} />
                        ))}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="flex gap-1">
                        {stickers.map((a) => (
                          <span key={a.id} title={a.name}>
                            <Badge achievement={a} className="size-8" />
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className={td}>
                      <Link
                        to="/draw/admin/prompts"
                        search={{ event: event.slug }}
                        className="underline whitespace-nowrap"
                      >
                        its prompts →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>

            {list.map((event) => {
              const Demo = THEME_DEMOS[event.theme];
              return (
                <Fragment key={event.id}>
                  <Section
                    title={
                      <span className="flex items-center gap-2">
                        <EventIcon
                          theme={event.theme}
                          name={event.name}
                          size={28}
                        />
                        {event.name}: how it went for everyone
                      </span>
                    }
                  >
                    <EventReport event={event} />
                  </Section>
                  {Demo && (
                    <Section
                      title={`${event.name}: theme demo`}
                      aside="a pretend player, to check the art"
                    >
                      <Demo event={event} />
                    </Section>
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </Loaded>
    </AdminPage>
  );
};

export default EventsPage;
