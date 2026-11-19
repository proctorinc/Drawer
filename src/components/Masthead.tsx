import { useState } from 'react';
import {
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import Logo from './Logo';
import ActivityBell from './ActivityBell';
import { ArrowLeftIcon, CheckIcon, FlameIcon } from './icons';
import type { FC } from 'react';
import useAuth from '@/auth/hooks/useAuth';
import { useGetMyProfile } from '@/api/Api';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { CountDownTimer } from '@/daily/CountdownTimer';
import { parseDay } from '@/days';
import { cn } from '@/utils';

/** The `day` key ("2026-11-18") `offset` days from another one */
const shiftDay = (day: string, offset: number) => {
  const [year, month, date] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset))
    .toISOString()
    .slice(0, 10);
};

/** The last seven pages, oldest first, each marked if you drew on it */
const useWeek = () => {
  const { data: profile } = useGetMyProfile();
  const { dailyPrompt } = useDailyPrompt();
  if (!profile || !dailyPrompt) return [];

  const drawn = new Set(profile.prompts.map((p) => p.day.slice(0, 10)));
  return Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(dailyPrompt.day, i - 6);
    return {
      day,
      letter: parseDay(day)
        .toLocaleDateString('en-US', { weekday: 'narrow' })
        .toLowerCase(),
      isDrawn: drawn.has(day),
      isToday: i === 6,
    };
  });
};

const StreakDetails: FC<{ streak: number }> = ({ streak }) => {
  const { dailyPrompt } = useDailyPrompt();
  const week = useWeek();
  const drewToday = dailyPrompt?.isCompleted ?? false;

  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="font-accent font-bold text-2xl leading-none">
        {streak === 0
          ? 'no streak yet'
          : `${streak} day${streak === 1 ? '' : 's'} in a row`}
      </h2>
      {week.length > 0 && (
        <ol className="flex justify-between">
          {week.map(({ day, letter, isDrawn, isToday }) => (
            <li
              key={day}
              className={cn(
                'flex flex-col items-center gap-1 text-sm text-pencil',
                isToday && 'font-bold text-ink',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center size-7 border-2 rounded-full',
                  isDrawn
                    ? 'bg-butter border-ink text-ink'
                    : 'border-dashed border-line',
                )}
              >
                {isDrawn && <CheckIcon size={14} strokeWidth={3} />}
              </span>
              {letter}
            </li>
          ))}
        </ol>
      )}
      <p className="leading-snug">
        {drewToday ? (
          "today's doodle is in, so your streak is safe. come back tomorrow to keep it going!"
        ) : streak > 0 ? (
          <>
            draw today's doodle in the next{' '}
            <CountDownTimer format="short" className="font-bold" /> to keep it
            alive.
          </>
        ) : (
          "draw today's doodle to start one. every day in a row adds to it."
        )}
      </p>
      <p className="text-sm text-pencil leading-snug">
        miss a day and it starts over from zero.
      </p>
    </div>
  );
};

const StreakBadge = () => {
  const { data: profile } = useGetMyProfile();
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  const streak = profile.stats.currentStreak;
  const isCold = streak === 0;

  return (
    <div
      className="relative"
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <button
        aria-label={`${streak} day streak`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'press flex items-center gap-1 h-10 pl-2.5 pr-3 border-2 rounded-[22px_18px_24px_16px/18px_24px_16px_22px] font-accent font-bold text-[22px] cursor-pointer animate-in zoom-in-75 fade-in duration-300',
          isCold
            ? 'bg-white border-line text-pencil'
            : 'bg-butter border-ink text-ink',
        )}
      >
        <FlameIcon
          className={cn(!isCold && 'animate-flicker origin-bottom')}
          {...(isCold && {
            fill: 'var(--color-line)',
            stroke: 'var(--color-pencil)',
          })}
        />
        {streak}
      </button>
      {open && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Your streak"
            className="absolute right-0 top-full z-50 mt-3 w-[min(18rem,calc(100vw-2.5rem))] bg-white border-2 border-ink rounded-sketch shadow-pencil origin-top-right animate-in fade-in zoom-in-95 duration-200"
          >
            <StreakDetails streak={streak} />
          </div>
        </>
      )}
    </div>
  );
};

/** The logo with its pencil swapped for a back arrow, so the logo itself goes back */
const BackLogo = () => {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();

  return (
    <button
      aria-label="Back"
      onClick={() =>
        canGoBack ? router.history.back() : navigate({ to: '/draw' })
      }
      className="group cursor-pointer"
    >
      <Logo
        icon={
          <span className="flex flex-none items-center justify-center size-12 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm transition-[translate,box-shadow,rotate] duration-150 group-hover:-rotate-6 group-active:translate-x-[2px] group-active:translate-y-[3px] group-active:shadow-none">
            <ArrowLeftIcon size={22} />
          </span>
        }
      />
    </button>
  );
};

type Props = {
  back?: boolean;
};

const Masthead: FC<Props> = ({ back }) => {
  const { isAuthenticated } = useAuth();

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 h-14 px-5 mt-4">
      {back ? (
        <BackLogo />
      ) : (
        <Link to="/draw" aria-label="Home">
          <Logo />
        </Link>
      )}
      {isAuthenticated && (
        <div className="flex items-center gap-2">
          <StreakBadge />
          <ActivityBell />
        </div>
      )}
    </header>
  );
};

export default Masthead;
