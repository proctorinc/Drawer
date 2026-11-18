import { countdownDates } from '../useChristmas';
import type { CSSProperties, FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';

// The tree is drawn in a 340×440 box and scales to its container's width
const BOX = { w: 340, h: 440 };
const CENTER = 170;

/** Ornament rows from the bottom up: [y, how many], spaced to the tree's width there */
const ROWS: Array<[number, number]> = [
  [360, 7],
  [315, 5],
  [270, 4],
  [220, 4],
  [180, 3],
  [145, 2],
  [108, 2],
  [72, 1],
];
/** The last day hangs where the star goes */
const STAR = { x: CENTER, y: 26 };

/** Half the tree's width at height y, following its three tiers */
function halfWidth(y: number) {
  if (y <= 130) return (y - 30) * 0.7;
  if (y <= 240) return 40 + (y - 130) * 0.682;
  return 80 + (y - 240) * 0.571;
}

/** Spots for every day but the last, bottom left first, climbing up the tree */
const SPOTS = ROWS.flatMap(([y, count]) => {
  const spread = halfWidth(y) * 0.78;
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? CENTER : CENTER - spread + (i * 2 * spread) / (count - 1),
    y,
  }));
});

const ORNAMENT_WIDTH = `${(32 / BOX.w) * 100}%`;

const at = (x: number, y: number): CSSProperties => ({
  left: `${(x / BOX.w) * 100}%`,
  top: `${(y / BOX.h) * 100}%`,
});

type OrnamentProps = {
  imageUrl?: string;
  isDone: boolean;
  isToday: boolean;
  delay: number;
  label: string;
};

/** A bauble holding that day's doodle, or an empty hook waiting for one */
const Ornament: FC<OrnamentProps> = ({
  imageUrl,
  isDone,
  isToday,
  delay,
  label,
}) => (
  <span className="relative block w-full aspect-square">
    {isDone && (
      <span
        aria-hidden="true"
        className="absolute -top-[18%] left-1/2 -ml-[17%] w-[34%] h-[22%] bg-xmas-gold border-[1.5px] border-ink rounded-[2px]"
      />
    )}
    <span
      role="img"
      aria-label={label}
      className={cn(
        'block size-full rounded-full overflow-hidden box-border',
        isDone &&
          'bg-white border-2 border-ink shadow-[inset_0_0_0_2px_#fff] animate-in zoom-in-0 duration-500 fill-mode-both ease-[var(--ease-spring)]',
        isToday && 'bg-white/70 border-2 border-xmas-red animate-twinkle',
        !isDone && !isToday && 'border-[1.5px] border-dashed border-[#8fa897]',
      )}
      style={isDone ? { animationDelay: `${delay}ms` } : undefined}
    >
      {isDone && imageUrl && (
        <DrawingImage
          imageUrl={imageUrl}
          draggable={false}
          className="object-cover"
        />
      )}
    </span>
  </span>
);

type Props = {
  event: ActiveEvent;
  /** That day's doodle, by YYYY-MM-DD */
  drawings?: Record<string, string>;
  className?: string;
};

/**
 * The event's tree, decorated with your doodles: each day you draw hangs as an
 * ornament, from the bottom up, and the last day crowns the top as the star.
 */
const ChristmasTree: FC<Props> = ({ event, drawings = {}, className }) => {
  const dates = countdownDates(event);
  const drawn = new Set(event.progress.doodledDays);
  const todayIndex = event.dayNumber - 1;
  const hung = dates.filter((date) => drawn.has(date)).length;
  const lastDate = dates.at(-1);

  const ornamentFor = (date: string, i: number) => (
    <Ornament
      imageUrl={drawings[date]}
      isDone={drawn.has(date)}
      isToday={i === todayIndex && !drawn.has(date)}
      delay={150 + i * 45}
      label={`Day ${i + 1}${drawn.has(date) ? '' : ', not drawn yet'}`}
    />
  );

  return (
    <div
      role="group"
      aria-label={`Christmas tree with ${hung} of ${dates.length} doodles hung`}
      className={cn('relative w-full max-w-[340px]', className)}
      style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}
    >
      <svg
        viewBox={`0 0 ${BOX.w} ${BOX.h}`}
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <path
          d="M170 30L240 130H210L285 240H250L330 380H10L90 240H55L130 130H100Z"
          fill="#ddf1e2"
          stroke="var(--color-ink)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* Tinsel looping across each tier */}
        <path
          d="M118 118q52 22 104 0M76 228q94 28 188 0M38 345q132 34 264 0"
          fill="none"
          stroke="var(--color-xmas-gold)"
          strokeWidth={2.5}
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        <rect
          x="152"
          y="380"
          width="36"
          height="40"
          rx="3"
          fill="#c99060"
          stroke="var(--color-ink)"
          strokeWidth={2.5}
        />
      </svg>

      {/* The star, holding the last day's doodle once it's drawn */}
      {lastDate && (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square"
          style={at(STAR.x, STAR.y)}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              'absolute inset-0 size-full',
              hung === dates.length ? 'animate-twinkle' : '',
            )}
          >
            <path
              d="M12 1.5l3.2 6.6 7.3.9-5.3 5 1.4 7.2L12 17.7l-6.6 3.5 1.4-7.2-5.3-5 7.3-.9z"
              fill={drawn.has(lastDate) ? 'var(--color-xmas-gold)' : '#fff6c9'}
              stroke="var(--color-ink)"
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeDasharray={drawn.has(lastDate) ? undefined : '1.5 1.5'}
            />
          </svg>
          <span className="absolute left-1/2 top-[56%] w-1/2 -translate-x-1/2 -translate-y-1/2">
            {ornamentFor(lastDate, dates.length - 1)}
          </span>
        </span>
      )}

      {dates.slice(0, -1).map((date, i) => (
        <span
          key={date}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ ...at(SPOTS[i].x, SPOTS[i].y), width: ORNAMENT_WIDTH }}
        >
          {ornamentFor(date, i)}
        </span>
      ))}
    </div>
  );
};

export default ChristmasTree;
