import { countdownDates } from '../useChristmas';
import type { FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import { cn } from '@/utils';

const ORNAMENT_COLORS = ['#e5483b', '#2f9e5b', '#ffb400', '#3a7bd5'];
/** Ornament rows from the top: [y, count]; the counts add up to 29 */
const ROWS: Array<[number, number]> = [
  [60, 2],
  [100, 3],
  [128, 4],
  [168, 5],
  [196, 6],
  [216, 9],
];

/** Spots on the tree, top to bottom, inside the tree's 220×262 box */
function ornamentSpots(count: number) {
  const spots: Array<{ x: number; y: number }> = [];
  for (const [y, perRow] of ROWS) {
    // The tree widens by about 0.42px per px down from its tip
    const halfWidth = (y - 18) * 0.42;
    for (let i = 0; i < perRow && spots.length < count; i++) {
      const x = 110 - halfWidth * 0.8 + (i * 1.6 * halfWidth) / (perRow - 1);
      spots.push({ x, y });
    }
  }
  return spots;
}

type Props = {
  event: ActiveEvent;
  className?: string;
};

/** A tree that gains an ornament for every countdown day you drew */
const ChristmasTree: FC<Props> = ({ event, className }) => {
  const dates = countdownDates(event);
  const drawn = new Set(event.progress.doodledDays);
  const todayIndex = event.dayNumber - 1;
  const hung = dates.filter((date) => drawn.has(date)).length;

  return (
    <div
      role="img"
      aria-label={`Christmas tree with ${hung} of ${dates.length} ornaments hung`}
      className={cn('relative w-[220px] h-[262px]', className)}
    >
      <svg width="220" height="262" viewBox="0 0 220 262" aria-hidden="true">
        <path
          d="M110 22L150 82H132L176 150H152L202 226H18L68 150H44L88 82H70Z"
          fill="#ddf1e2"
          stroke="var(--color-ink)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <path
          d="M70 82q40 14 62 0M44 150q66 18 108 0"
          fill="none"
          stroke="var(--color-xmas-green)"
          strokeWidth={2}
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
        <rect
          x="97"
          y="226"
          width="26"
          height="26"
          fill="#c99060"
          stroke="var(--color-ink)"
          strokeWidth={2.5}
        />
      </svg>
      <svg
        aria-hidden="true"
        width="34"
        height="34"
        viewBox="0 0 24 24"
        className={cn(
          'absolute top-0.5 left-[93px]',
          hung === dates.length ? 'animate-twinkle' : 'opacity-40',
        )}
      >
        <path
          d="M12 2l2.9 6.2 6.8.7-5.1 4.6 1.5 6.7L12 16.8 5.9 20.2l1.5-6.7L2.3 8.9l6.8-.7z"
          fill="var(--color-xmas-gold)"
          stroke="var(--color-ink)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
      {ornamentSpots(dates.length).map(({ x, y }, i) => {
        const isDone = drawn.has(dates[i]);
        const isToday = i === todayIndex && !isDone;
        return (
          <span
            key={dates[i]}
            className={cn(
              'absolute size-3.5 box-border rounded-full',
              isDone &&
                'border-[1.8px] border-ink shadow-[inset_-2px_-3px_0_rgba(0,0,0,0.15)] animate-in zoom-in-0 duration-500 fill-mode-both ease-[var(--ease-spring)]',
              isToday && 'bg-white border-2 border-xmas-red animate-twinkle',
              !isDone &&
                !isToday &&
                'border-[1.5px] border-dashed border-[#8fa897]',
            )}
            style={{
              left: x - 7,
              top: y - 7,
              backgroundColor: isDone
                ? ORNAMENT_COLORS[i % ORNAMENT_COLORS.length]
                : undefined,
              animationDelay: isDone ? `${200 + i * 40}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
};

export default ChristmasTree;
