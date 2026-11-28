import { Link } from '@tanstack/react-router';
import { countdownDates } from '../useChristmas';
import { GrinchHead } from './GrinchOutline';
import TreeArt, { TREE_BOX } from './TreeArt';
import type { CSSProperties, FC } from 'react';
import type { ActiveEvent, GrinchDay } from '@/api/events';
import { LockIcon, RedoIcon } from '@/components/icons';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';

// The tree is drawn in TreeArt's box and scales to its container's width
const BOX = TREE_BOX;
const CENTER = 170;

/**
 * Ornament rows from the bottom up: [y, how many]. Neighbouring rows alternate
 * odd and even counts on the same pitch, so each ornament sits in the gap
 * between the two below it, and every cap rests on a branch. They come in
 * tiers (3 rows, 3, then 2), with a wider gap between tiers where a hem runs.
 */
const ROWS: Array<[number, number]> = [
  [386, 6],
  [348, 5],
  [310, 4],
  [258, 3],
  [220, 4],
  [182, 3],
  [130, 2],
  [92, 1],
];
/** Space between ornaments' centres along a row */
const PITCH = 48;
/** Half the gap between rows: a row's band of the tree runs this far above and below it */
const ROW_HALF = 19;
/** The tree's tip, where the fill tops out once the star's day comes */
const TREE_TIP = 28;

/**
 * How far up the tree is filled in: to the top of the highest row whose days
 * have all come round, and right up to the tip once the star's day has. Null
 * before the bottom row is done.
 */
function filledTo(todayIndex: number, days: number): number | null {
  if (todayIndex >= days - 1) return TREE_TIP;
  let last = -1;
  let top: number | null = null;
  for (const [y, count] of ROWS) {
    last += count;
    if (last >= days - 1 || todayIndex < last) break;
    top = y - ROW_HALF;
  }
  return top;
}

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

/** "December 3", for a YYYY-MM-DD day */
const monthDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** A missed day you can still redo: a soft berry outline on a blush fill */
const REDO_COLOR = '#d9675b';
const REDO_FILL = '#fdeae4';

/** A small, stable tilt per day so the ornaments don't hang like a grid */
const tilt = (i: number) => `${((i * 37) % 19) - 9}deg`;

/** A hung doodle; `locked` when it's a day you can still draw, so it's kept from you */
type Doodle = { id: string; imageUrl: string; locked?: boolean };

/** How long one breath of the wave takes, matching --animate-breathe */
const BREATH_MS = 5000;

/**
 * Where a spot is in the wave rolling up the tree: the bottom row swells
 * first, the star last, with a little drift across each row. Negative, so the
 * tree's already moving when it appears.
 */
const breathDelay = ({ x, y }: { x: number; y: number }) =>
  `${-Math.round(((y / BOX.h) * 0.6 + (x / BOX.w) * 0.12) * BREATH_MS)}ms`;

/** A four-point sparkle that pops at the top of an empty slot's breath */
const Sparkle: FC<{ delay: string; color: string }> = ({ delay, color }) => (
  <svg
    aria-hidden="true"
    viewBox="-5 -5 10 10"
    className="absolute -top-[14%] -right-[14%] w-[42%] opacity-0 animate-sparkle pointer-events-none"
    style={{ animationDelay: delay }}
  >
    <path
      d="M0-5Q0 0 5 0Q0 0 0 5Q0 0-5 0Q0 0 0-5z"
      fill="#fff"
      stroke={color}
      strokeWidth={0.8}
      strokeLinejoin="round"
    />
  </svg>
);

type OrnamentProps = {
  doodle?: Doodle;
  isDone: boolean;
  isToday: boolean;
  delay: number;
  label: string;
  /** The day of the month, written faintly in its slot until it's drawn */
  day: number;
  /** The last day, held in the star: its empty slot is gold, not green */
  star?: boolean;
  /** Its place in the wave rolling up the tree (see breathDelay) */
  breath: string;
  /** A day the Grinch judges: until it's drawn, its hook is his head's outline */
  grinch?: boolean;
  /** A missed day you can still draw (YYYY-MM-DD): its slot opens the redo desk */
  redoDay?: string;
  /** The event whose tree this is, for the redo desk's way back */
  eventSlug: string;
};

/** A bauble holding that day's doodle, or an empty hook waiting for one */
const Ornament: FC<OrnamentProps> = ({
  doodle,
  isDone,
  isToday,
  delay,
  label,
  day,
  breath,
  grinch,
  star,
  redoDay,
  eventSlug,
}) => {
  const empty = !isDone && !isToday;
  // An empty slot's outline and day: pine green, gold up in the star, or a
  // soft berry red on a missed day waiting to be redone
  const slotColor = redoDay ? REDO_COLOR : star ? '#d99a00' : '#8fa897';
  const bauble =
    grinch && !isDone && !redoDay ? (
      <span
        role="img"
        aria-label={label}
        className={cn(
          'relative block w-full aspect-square scale-[1.35]',
          isToday && 'animate-breathe',
        )}
      >
        <GrinchHead
          state="empty"
          color={isToday ? 'var(--color-xmas-red)' : '#5f8f3a'}
          className="size-full"
          question
        />
      </span>
    ) : (
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
            'relative block size-full rounded-full overflow-hidden box-border',
            isDone &&
              'bg-white border-2 border-ink shadow-[inset_0_0_0_2px_#fff] animate-in zoom-in-0 duration-500 fill-mode-both ease-[var(--ease-spring)]',
            isToday && 'bg-white/70 border-2 border-xmas-red animate-beacon',
            !isDone && !isToday && 'border-[1.5px] border-dashed',
          )}
          style={
            isDone
              ? { animationDelay: `${delay}ms` }
              : empty
                ? {
                    borderColor: slotColor,
                    backgroundColor: redoDay ? REDO_FILL : undefined,
                  }
                : undefined
          }
        >
          {isDone &&
            doodle &&
            (doodle.locked ? (
              <span className="absolute inset-0 grid place-items-center bg-paper">
                <LockIcon
                  fill="var(--color-me)"
                  className="size-[55%] -rotate-6 text-ink"
                />
              </span>
            ) : (
              <DrawingImage
                imageUrl={doodle.imageUrl}
                draggable={false}
                className="object-cover"
              />
            ))}
          {/* A glint of light across the glass at the top of each breath */}
          {isDone && (
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-0 animate-glint pointer-events-none bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.85)_50%,transparent_62%)]"
              style={{ animationDelay: breath }}
            />
          )}
          {/* A missed day you can redo wears the redo arrow in place of its day */}
          {redoDay && (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center"
              style={{ color: slotColor }}
            >
              <RedoIcon strokeWidth={2.75} className="size-[58%]" />
            </span>
          )}
          {/* An empty slot keeps its day, so it reads as one waiting to be drawn */}
          {empty && !redoDay && (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center font-accent font-bold text-[clamp(8px,3vw,12px)] leading-none"
              style={{ color: slotColor }}
            >
              {day}
            </span>
          )}
        </span>
      </span>
    );

  // Every spot moves with the wave, today's aside (it twinkles on its own):
  // ornaments swell as their glint crosses them, empty slots just breathe
  const breathing = isToday ? (
    bauble
  ) : (
    <span
      className={cn(
        'relative block',
        isDone ? 'animate-swell' : 'animate-breathe',
      )}
      style={
        {
          animationDelay: breath,
          '--breathe-to': isDone ? 1.12 : 1.04,
        } as CSSProperties
      }
    >
      {bauble}
      {empty && <Sparkle delay={breath} color={slotColor} />}
    </span>
  );

  if (redoDay) {
    return (
      <Link
        to="/draw/redo/$day"
        params={{ day: redoDay }}
        search={{ event: eventSlug }}
        aria-label={`${label}, redo it`}
        className="block transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-125 active:scale-95"
      >
        {breathing}
      </Link>
    );
  }

  if (!doodle) return breathing;

  return (
    <Link
      to="/draw/submission/$submissionId"
      params={{ submissionId: doodle.id }}
      className="block transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-125 active:scale-95"
    >
      {breathing}
    </Link>
  );
};

type Props = {
  event: ActiveEvent;
  /** That day's doodle, by YYYY-MM-DD; its ornament opens it */
  drawings?: Record<string, Doodle | undefined>;
  /** The days the Grinch judges, whose empty hooks look like him */
  grinchDays?: Array<GrinchDay>;
  /** Missed days you can still draw with a redo, by YYYY-MM-DD; tapping one starts it */
  redoDays?: Set<string>;
  className?: string;
};

/**
 * The event's tree, decorated with your doodles: each day you draw hangs as an
 * ornament, from the bottom up, and the last day crowns the top as the star.
 */
const ChristmasTree: FC<Props> = ({
  event,
  drawings = {},
  grinchDays = [],
  redoDays,
  className,
}) => {
  const dates = countdownDates(event);
  const grinchDates = new Set(grinchDays.map((d) => d.day));
  const drawn = new Set(event.progress.doodledDays);
  const todayIndex = event.dayNumber - 1;
  const hung = dates.filter((date) => drawn.has(date)).length;
  const lastDate = dates.at(-1);
  const fillTop = filledTo(todayIndex, dates.length);

  const ornamentFor = (date: string, i: number) => (
    <Ornament
      doodle={drawings[date]}
      isDone={drawn.has(date)}
      isToday={i === todayIndex && !drawn.has(date)}
      delay={150 + i * 45}
      label={`${monthDay(date)}${grinchDates.has(date) ? ', a grinch day' : ''}${drawn.has(date) ? '' : ', not drawn yet'}`}
      grinch={grinchDates.has(date)}
      day={Number(date.slice(8, 10))}
      star={i === dates.length - 1}
      breath={breathDelay(i === dates.length - 1 ? STAR : SPOTS[i])}
      redoDay={!drawn.has(date) && redoDays?.has(date) ? date : undefined}
      eventSlug={event.slug}
    />
  );

  return (
    <div
      role="group"
      aria-label={`Christmas tree with ${hung} of ${dates.length} doodles hung`}
      className={cn('relative w-full max-w-[340px]', className)}
      style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}
    >
      <TreeArt
        filledTop={fillTop}
        starLit={!!lastDate && todayIndex >= dates.length - 1}
      />

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
              // Inked once it holds the last doodle; till then a soft gold dotted outline
              stroke={drawn.has(lastDate) ? 'var(--color-ink)' : '#e0a400'}
              strokeWidth={drawn.has(lastDate) ? 1.2 : 0.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={drawn.has(lastDate) ? undefined : '0.6 1.1'}
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
