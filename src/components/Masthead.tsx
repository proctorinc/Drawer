import {
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import Logo from './Logo';
import ActivityBell from './ActivityBell';
import { ArrowLeftIcon, FlameIcon } from './icons';
import type { FC, ReactNode } from 'react';
import useAuth from '@/auth/hooks/useAuth';
import { useGetMyProfile } from '@/api/Api';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { parseDay } from '@/days';
import { cn, dabShapes } from '@/utils';
import { Holly, SantaHat } from '@/events/christmas/Decorations';
import { countdownCopy, useChristmas } from '@/events/useChristmas';

const StreakBadge = () => {
  const { data: profile } = useGetMyProfile();
  if (!profile) return null;

  return (
    <div
      aria-label={`${profile.stats.currentStreak} day streak`}
      className="flex items-center gap-1 h-10 pl-2.5 pr-3 bg-butter border-2 border-ink rounded-[22px_18px_24px_16px/18px_24px_16px_22px] font-accent font-bold text-[22px] animate-in zoom-in-75 fade-in duration-300"
    >
      <FlameIcon className="animate-flicker origin-bottom" />
      {profile.stats.currentStreak}
    </div>
  );
};

/** Today's three colors as little paint dabs */
export const TodaysCrayons = () => {
  const { dailyPrompt } = useDailyPrompt();
  const colors = dailyPrompt?.colors.slice(0, 3) ?? [];
  if (colors.length === 0) return null;

  return (
    <span className="flex items-center gap-1.5">
      today's crayons
      {colors.map((color, i) => (
        <span
          key={color + i}
          className={cn(
            'size-3.5 animate-in zoom-in-0 duration-300 fill-mode-both',
            dabShapes[i % dabShapes.length],
          )}
          style={{
            backgroundColor: color,
            animationDelay: `${200 + i * 80}ms`,
          }}
        />
      ))}
    </span>
  );
};

const BackButton = () => {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();

  return (
    <button
      aria-label="Back"
      onClick={() =>
        canGoBack ? router.history.back() : navigate({ to: '/draw' })
      }
      className="press flex flex-none items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm hover:-rotate-6 cursor-pointer"
    >
      <ArrowLeftIcon size={20} />
    </button>
  );
};

type Props = {
  back?: boolean;
  /** Right side of the date line; defaults to today's crayons */
  aside?: ReactNode;
};

const dateLabel = (date: Date) =>
  date
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toLowerCase();

const Masthead: FC<Props> = ({ back, aside }) => {
  const { isAuthenticated } = useAuth();
  // The page turns at midnight UTC, so date it by the prompt rather than your clock
  const { dailyPrompt } = useDailyPrompt();
  const pageDate = dailyPrompt ? parseDay(dailyPrompt.day) : new Date();
  const christmas = useChristmas();
  const countdown = christmas && countdownCopy(christmas);

  return (
    <header className="flex flex-col gap-2 px-5 pt-4">
      <div className="flex items-center justify-between gap-2 h-14">
        <div className="flex items-center gap-3">
          {back && <BackButton />}
          <Link
            to="/draw"
            aria-label="Home"
            className="relative flex items-end gap-0.5"
          >
            <Logo />
            {christmas && (
              <>
                <SantaHat className="top-[-14px] left-[24px] right-auto w-10" />
                <Holly className="mb-1 animate-in zoom-in-0 duration-500 delay-300 fill-mode-both" />
              </>
            )}
          </Link>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <StreakBadge />
            <ActivityBell />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 h-[30px] border-b-2 border-dashed border-line text-pencil">
        <span>{countdown ? countdown.day : dateLabel(pageDate)}</span>
        {aside ??
          (countdown ? <span>{countdown.left}</span> : <TodaysCrayons />)}
      </div>
    </header>
  );
};

export default Masthead;
