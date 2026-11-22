import { Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useChristmas } from '../useChristmas';
import { SantaHatIcon, TreeIcon } from './Decorations';
import Lights from './Lights';
import StickerReward from './StickerReward';
import type { FC, ReactNode } from 'react';
import type { ActiveEvent } from '@/api/events';
import { useGetAchievements } from '@/api/Api';
import Button from '@/components/Button';
import { InfoIcon, StarIcon, TrophyIcon } from '@/components/icons';
import useLocalStorage from '@/hooks/useLocalStorage';
import Sheet from '@/pages/profile/components/Sheet';
import { cn } from '@/utils';

/** Slugs of the events whose intro has already popped up on this device */
const SEEN_KEY = 'EVENT_INTROS_SEEN';

const lastDay = (event: ActiveEvent) =>
  new Date(new Date(event.endsAt).getTime() - 86_400_000)
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .toLowerCase();

const Point: FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <li className="flex gap-3">
    <span className="flex-none flex items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt">
      {icon}
    </span>
    <span className="flex flex-col leading-snug">
      <b className="font-accent font-bold text-xl leading-tight">{title}</b>
      <span className="text-pencil">{children}</span>
    </span>
  </li>
);

type SheetProps = {
  event: ActiveEvent;
  open: boolean;
  onClose: () => void;
};

/** Everything the Christmas event is: how it works, what you can win, how long it runs */
const ChristmasIntroSheet: FC<SheetProps> = ({ event, open, onClose }) => {
  const { data: achievements } = useGetAchievements();
  const stickers =
    achievements?.achievements.filter((a) => a.eventSlug === event.slug) ?? [];
  const days = event.countdownDays;

  return (
    <Sheet title={event.name.toLowerCase()} open={open} onClose={onClose}>
      <div className="-mx-6 -mt-3">
        <Lights bulbs={13} />
      </div>
      <p className="-mt-3 text-lg leading-snug">
        {days ? (
          <>
            <b>{days} days</b> of doodles counting down to christmas. one prompt
            a day, and every one you draw hangs on your tree as an ornament.
          </>
        ) : (
          <>a festive doodle every day while the event runs.</>
        )}
      </p>

      <ul className="flex flex-col gap-3">
        <Point
          icon={<TreeIcon size={22} className="text-ink" />}
          title="fill your tree"
        >
          {days
            ? `doodle on all ${days} days for a full tree. miss one and its spot stays bare`
            : 'every doodle you draw hangs on your tree'}
        </Point>
        <Point
          icon={<SantaHatIcon size={24} />}
          title="a santa hat on everyone"
        >
          every face gets a red hat while it runs. wear any flair to swap it out
        </Point>
        <Point
          icon={
            <svg aria-hidden="true" width={20} height={20} viewBox="0 0 12 12">
              <path
                d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5"
                stroke="var(--color-snow)"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            </svg>
          }
          title="christmas reactions"
        >
          extra stickers to slap on friends' doodles, only till it's over
        </Point>
        <Point icon={<TrophyIcon size={20} />} title="quests & standings">
          weekly quests move to the event page, next to a christmas leaderboard
          with your friends
        </Point>
        <Point
          icon={<StarIcon size={20} fill="var(--color-butter)" />}
          title="event XP"
        >
          everything you earn while it runs is tallied on the event page
        </Point>
      </ul>

      {stickers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-accent font-bold text-2xl leading-none">
            the rewards
          </h3>
          <p className="-mt-1 text-pencil">
            earn a sticker to wear its flair on your face, for keeps
          </p>
          <div className="grid grid-cols-3 gap-2 w-full">
            {stickers.map((sticker) => (
              <StickerReward key={sticker.id} sticker={sticker} />
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-pencil">
        runs till {lastDay(event)}. after that, your tree stays up to look back
        on
      </p>

      <div className="flex flex-col gap-2">
        <Button onClick={onClose}>let's doodle</Button>
        <Link
          to="/draw/event/$slug"
          params={{ slug: event.slug }}
          onClick={onClose}
          className="text-center font-accent font-bold text-xl text-pencil hover:text-ink transition-colors"
        >
          see my tree →
        </Link>
      </div>
    </Sheet>
  );
};

function useIntroSeen(slug: string | undefined) {
  const [seen, setSeen] = useLocalStorage<Array<string>>(SEEN_KEY, [], 0);
  const markSeen = useCallback(() => {
    if (slug)
      setSeen((slugs) => (slugs.includes(slug) ? slugs : [...slugs, slug]));
  }, [slug, setSeen]);
  return { seen: !!slug && seen.includes(slug), markSeen };
}

/**
 * Pops the intro up the first time you show up during the event, on this
 * device. Closing it, any way, means it won't come back on its own.
 */
export const ChristmasIntroOnce: FC = () => {
  const christmas = useChristmas();
  const { seen, markSeen } = useIntroSeen(christmas?.slug);
  if (!christmas) return null;

  return (
    <ChristmasIntroSheet event={christmas} open={!seen} onClose={markSeen} />
  );
};

/** A button that brings the intro back, for anyone who wants another look */
export const ChristmasIntroButton: FC<{
  event: ActiveEvent;
  className?: string;
}> = ({ event, className }) => {
  const [open, setOpen] = useState(false);
  const { markSeen } = useIntroSeen(event.slug);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'press inline-flex items-center gap-1.5 h-8 px-2.5 bg-white border-[1.5px] border-ink rounded-[14px_10px_14px_12px] text-[15px] text-ink cursor-pointer',
          className,
        )}
      >
        <InfoIcon size={18} className="text-pencil" />
        how it works
      </button>
      <ChristmasIntroSheet
        event={event}
        open={open}
        onClose={() => {
          setOpen(false);
          markSeen();
        }}
      />
    </>
  );
};
