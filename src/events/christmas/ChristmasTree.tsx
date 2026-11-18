import { Link } from '@tanstack/react-router';
import { countdownDates } from '../useChristmas';
import type { CSSProperties, FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';

// The tree is drawn in a 340×440 box and scales to its container's width
const BOX = { w: 340, h: 440 };
const CENTER = 170;

/**
 * Ornament rows from the bottom up: [y, how many]. Neighbouring rows alternate
 * odd and even counts on the same pitch, so each ornament sits in the gap
 * between the two below it, and every cap rests on a branch.
 */
const ROWS: Array<[number, number]> = [
  [362, 6],
  [324, 5],
  [286, 4],
  [248, 3],
  [210, 4],
  [172, 3],
  [134, 2],
  [96, 1],
];
/** Space between ornaments' centres along a row */
const PITCH = 48;
/** The last day hangs where the star goes */
const STAR = { x: CENTER, y: 26 };

/** Spots for every day but the last, bottom left first, climbing up the tree */
const SPOTS = ROWS.flatMap(([y, count]) =>
  Array.from({ length: count }, (_, i) => ({
    x: CENTER + (i - (count - 1) / 2) * PITCH,
    y,
  })),
);

const ORNAMENT_WIDTH = `${(32 / BOX.w) * 100}%`;

const at = (x: number, y: number): CSSProperties => ({
  left: `${(x / BOX.w) * 100}%`,
  top: `${(y / BOX.h) * 100}%`,
});

/** A small, stable tilt per day so the ornaments don't hang like a grid */
const tilt = (i: number) => `${((i * 37) % 19) - 9}deg`;

type Doodle = { id: string; imageUrl: string };

type OrnamentProps = {
  doodle?: Doodle;
  isDone: boolean;
  isToday: boolean;
  delay: number;
  label: string;
};

/** A bauble holding that day's doodle, or an empty hook waiting for one */
const Ornament: FC<OrnamentProps> = ({
  doodle,
  isDone,
  isToday,
  delay,
  label,
}) => {
  const bauble = (
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
          !isDone &&
            !isToday &&
            'border-[1.5px] border-dashed border-[#8fa897]',
        )}
        style={isDone ? { animationDelay: `${delay}ms` } : undefined}
      >
        {isDone && doodle && (
          <DrawingImage
            imageUrl={doodle.imageUrl}
            draggable={false}
            className="object-cover"
          />
        )}
      </span>
    </span>
  );

  if (!doodle) return bauble;

  return (
    <Link
      to="/draw/submission/$submissionId"
      params={{ submissionId: doodle.id }}
      className="block transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-125 active:scale-95"
    >
      {bauble}
    </Link>
  );
};

type Props = {
  event: ActiveEvent;
  /** That day's doodle, by YYYY-MM-DD; its ornament opens it */
  drawings?: Record<string, Doodle | undefined>;
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
      doodle={drawings[date]}
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
          style={{
            ...at(SPOTS[i].x, SPOTS[i].y),
            width: ORNAMENT_WIDTH,
            rotate: tilt(i),
          }}
        >
          {ornamentFor(date, i)}
        </span>
      ))}
    </div>
  );
};

export default ChristmasTree;
