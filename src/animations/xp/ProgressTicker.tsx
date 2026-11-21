import './xp.css';
import { useEffect, useRef, useState } from 'react';
import { usePopdownBottom, useReducedMotion } from './lane';
import { LevelBar } from './LevelBar';
import type { FC } from 'react';
import type { TickerItem, TickerProps } from '../types';
import { CheckIcon, StarIcon, TrophyIcon } from '@/components/icons';
import { cn } from '@/utils';
import { tickerComplete, tickerCount, tickerIn } from '@/sound/sfx';

/** Let the pill land before the bar moves */
const FILL_DELAY_MS = 300;
const FILL_MS = 700;
/** When it starts leaving, and how long that takes (~2.5s total) */
const LEAVE_AT_MS = 2250;
const EXIT_MS = 250;

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;

const FALLBACK_ICON: Record<TickerItem['kind'], FC<{ size?: number }>> = {
  stickerProgress: ({ size }) => (
    <StarIcon size={size} fill="var(--color-butter)" />
  ),
  questProgress: ({ size }) => <CheckIcon size={size} />,
  achievementProgress: ({ size }) => <TrophyIcon size={size} />,
};

/**
 * A small pill that pings in at the top for sticker, quest or achievement
 * progress: picture, label and a mini bar ticking from `from` to `to` of
 * `goal`. Sits under the XP popdown when one is showing and slides up when
 * it goes. Never blocks anything outside the pill; tap to dismiss.
 */
export const ProgressTicker: FC<TickerProps> = ({ item, onDone }) => {
  const { from, to, goal, label, imageUrl, kind, more } = item;
  const reduced = useReducedMotion();
  const popdownBottom = usePopdownBottom();
  const [count, setCount] = useState(reduced ? to : from);
  const [frac, setFrac] = useState(() => ratio(reduced ? to : from, goal));
  const [leaving, setLeaving] = useState(false);

  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Fill the bar and tick the count, then leave
  useEffect(() => {
    const leaveId = window.setTimeout(() => setLeaving(true), LEAVE_AT_MS);
    if (reduced) return () => window.clearTimeout(leaveId);
    let raf = 0;
    let start: number | undefined;
    let heard = from;
    tickerIn();
    const tick = (now: number) => {
      start ??= now;
      const u = Math.min(
        1,
        Math.max(0, (now - start - FILL_DELAY_MS) / FILL_MS),
      );
      const value = from + (to - from) * easeOutCubic(u);
      setFrac(ratio(value, goal));
      setCount(Math.round(value));
      const counted = Math.round(value);
      if (counted > heard) {
        heard = counted;
        if (counted >= goal) tickerComplete();
        else tickerCount(counted, goal);
      }
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(leaveId);
      cancelAnimationFrame(raf);
    };
  }, [from, to, goal, reduced]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(
      () => {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current();
      },
      reduced ? 0 : EXIT_MS,
    );
    return () => window.clearTimeout(id);
  }, [leaving, reduced]);

  const Icon = FALLBACK_ICON[kind];
  const complete = count >= goal;

  return (
    <div
      className="xp-ticker-slot fixed inset-x-0 top-0 z-[79] flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))] pointer-events-none"
      // The slot's own top padding leaves the gap under the popdown's card
      style={{ translate: `0 ${popdownBottom}px` }}
    >
      <p role="status" className="sr-only">
        {`${label}: ${to} of ${goal}`}
        {more ? `, and ${more} more` : ''}
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setLeaving(true)}
        className={cn(
          'pointer-events-auto flex items-center gap-2 max-w-[340px] h-10 pl-1.5 pr-3 bg-white border-2 border-ink rounded-full text-ink cursor-pointer',
          !reduced && (leaving ? 'xp-ticker-out' : 'xp-ticker-in'),
        )}
      >
        <span
          aria-hidden="true"
          className="flex flex-none items-center justify-center size-7 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <Icon size={16} />
          )}
        </span>
        <span className="flex-1 min-w-0 truncate text-[15px] leading-tight">
          {label}
        </span>
        <LevelBar
          frac={frac}
          fill={complete ? 'var(--color-gold)' : 'var(--color-me)'}
          className="flex-none w-14 h-3 border-[1.5px]"
        />
        <span
          aria-hidden="true"
          className="flex-none font-accent font-bold text-lg leading-none tabular-nums"
        >
          {/* A new key replays the bump each time the count ticks */}
          <span
            key={count}
            className={cn(count !== from && !reduced && 'xp-count-bump')}
          >
            {count}
          </span>
          /{goal}
        </span>
        {more ? (
          <span
            aria-hidden="true"
            className="flex-none -mr-1.5 px-1.5 rounded-full border-[1.5px] border-ink bg-butter text-xs font-bold leading-5"
          >
            +{more}
          </span>
        ) : null}
      </button>
    </div>
  );
};

function ratio(value: number, goal: number): number {
  return goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 1;
}
