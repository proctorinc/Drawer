import './xp.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildFillPlan, sampleFill } from './fillPlan';
import { setPopdownBottom, useReducedMotion } from './lane';
import { LevelBar } from './LevelBar';
import type { CSSProperties } from 'react';
import type { StageComponent } from '../types';
import { LevelBadge } from '@/levels/LevelBadge';
import { RANK_CARDS } from '@/levels/rankCards';
import { levelTitle, rankFor } from '@/levels/ranks';
import { cn } from '@/utils';

/** Wait for the card to land before the bar starts moving */
const FILL_DELAY_MS = 380;
/** How long the finished card stays up */
const HOLD_MS = 1500;
/** Slide back up */
const EXIT_MS = 300;
/** Reduced motion: just show the end state for this long */
const STILL_MS = 1800;

const BURST = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * A compact card that drops from the top: the level badge, "+N XP" counting
 * up and the level bar sweeping from the old snapshot to the new one,
 * rolling over (badge pops, bar resets) for each level gained. A rank tier
 * change gets a punchier badge swap; the full-screen rank-up is its own
 * stage item. Tap to dismiss. Only the card takes clicks.
 */
export const XPPopdown: StageComponent<'xp'> = ({ payload, onDone }) => {
  const { from, to, gained } = payload;
  const reduced = useReducedMotion();
  const plan = useMemo(() => buildFillPlan(from, to), [from, to]);
  const final = useMemo(() => sampleFill(plan, Infinity), [plan]);
  const [frame, setFrame] = useState(() =>
    reduced ? final : sampleFill(plan, 0),
  );
  const [leaving, setLeaving] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  // onDone exactly once, whichever path gets there first
  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Drive the bar, then hold, then leave
  useEffect(() => {
    if (reduced) {
      const id = window.setTimeout(() => setLeaving(true), STILL_MS);
      return () => window.clearTimeout(id);
    }
    let raf = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const t = now - start;
      setFrame(sampleFill(plan, t - FILL_DELAY_MS));
      if (t >= FILL_DELAY_MS + plan.duration + HOLD_MS) {
        setLeaving(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan, reduced]);

  // Once leaving, finish after the slide-up
  useEffect(() => {
    if (!leaving) return;
    setPopdownBottom(0);
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

  // Tell the ticker lane where our bottom edge is so pings sit below us
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card) setPopdownBottom(card.offsetTop + card.offsetHeight);
    return () => setPopdownBottom(0);
  }, []);

  const level = Math.min(Math.max(frame.level, from.level), to.level);
  const tier = rankFor(level);
  const leveledUp = level > from.level;
  const tierChangedNow = leveledUp && rankFor(level - 1).id !== tier.id;
  const tierChanged = tier.id !== rankFor(from.level).id;
  const xpShown = Math.round(gained * (reduced ? 1 : frame.progress));
  const fill = RANK_CARDS[tier.id].fill;
  const title = levelTitle(level);
  const titleChanged = title !== levelTitle(from.level);

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))] pointer-events-none">
      <p role="status" className="sr-only">
        {`+${gained} XP. Level ${to.level}, ${levelTitle(to.level)}${
          tierChanged ? `, ${rankFor(to.level).name} rank` : ''
        }.`}
      </p>
      <button
        ref={cardRef}
        type="button"
        aria-label="Dismiss"
        onClick={() => setLeaving(true)}
        className={cn(
          'pointer-events-auto flex items-center gap-3 w-full max-w-[340px] p-3 pr-4 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm text-left text-ink cursor-pointer',
          !reduced && (leaving ? 'xp-out' : 'xp-in'),
        )}
      >
        <span className="relative flex-none" aria-hidden="true">
          {/* A new key replays the pop on every level change */}
          <span
            key={level}
            className={cn(
              'block',
              tierChangedNow ? 'xp-badge-punch' : leveledUp && 'xp-badge-pop',
            )}
          >
            <LevelBadge level={level} size={48} />
          </span>
          {tierChangedNow && !reduced && (
            <span key={`burst-${level}`} className="absolute inset-0">
              {BURST.map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <span
                    key={angle}
                    className="xp-burst"
                    style={
                      {
                        '--r': `${angle + 90}deg`,
                        '--dx': `${Math.cos(rad) * 36}px`,
                        '--dy': `${Math.sin(rad) * 36}px`,
                      } as CSSProperties
                    }
                  />
                );
              })}
            </span>
          )}
        </span>
        <span className="flex flex-col flex-1 min-w-0 gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-accent font-bold text-[30px] leading-none tabular-nums whitespace-nowrap">
              +{xpShown}
              <span className="ml-1 text-lg">XP</span>
            </span>
            {leveledUp && (
              <span
                key={tierChanged ? tier.id : 'level-up'}
                className="xp-tag inline-block px-1.5 font-accent font-bold text-lg leading-tight whitespace-nowrap bg-me border-[1.5px] border-ink rounded-sketch-alt"
              >
                {tierChanged ? `${tier.name.toLowerCase()}!` : 'level up!'}
              </span>
            )}
          </span>
          <LevelBar frac={frame.frac} fill={fill} />
          <span className="flex items-baseline gap-1.5 min-w-0 text-sm text-pencil leading-none whitespace-nowrap">
            <span className="tabular-nums">level {level}</span>
            <span aria-hidden="true">·</span>
            {/* A new key pops the title in whenever it changes */}
            <span
              key={title}
              className={cn(
                'truncate font-accent font-bold text-[1rem] text-ink',
                titleChanged && 'xp-tag',
              )}
            >
              <span className="highlight">{title.toLowerCase()}</span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
};
