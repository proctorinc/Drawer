import { AI_SCORE_MAX } from './score';
import type { CSSProperties, FC } from 'react';
import type { AIReview } from '@/api/Api';
import { cn } from '@/utils';

/** A doodle the AI judge gave a perfect score: it gets the gold frame everywhere */
export const isMasterpiece = (doodle?: { aiReview?: AIReview | null } | null) =>
  doodle?.aiReview?.status === 'done' &&
  (doodle.aiReview.score ?? 0) >= AI_SCORE_MAX;

/** In place of a polaroid's white frame: solid gold with an ink outline */
export const goldFrameClass = 'bg-gold border-2 border-ink';

/** One corner's flourish: a scrolled bracket with a curl and a jewel */
const Flourish: FC<{
  size: number;
  style: CSSProperties;
  className?: string;
}> = ({ size, style, className }) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    aria-hidden="true"
    style={style}
    className={cn('absolute z-[3] pointer-events-none', className)}
  >
    {/* A scalloped corner piece */}
    <path
      d="M2 2h30c-4 3-8 3.5-11 6.5 1.5 3-1 6-4.5 5.5C16 17.5 13 20 8.5 21 6 25 5.5 29 2 32z"
      fill="var(--color-gold)"
      stroke="var(--color-ink)"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    {/* Scrollwork curls off each arm */}
    <path
      d="M24 6c4-1 7 1 6 4-.7 2.2-3.6 2-3.8-.2M6 24c-1 4 1 7 4 6 2.2-.7 2-3.6-.2-3.8"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* The jewel */}
    <circle
      cx="9"
      cy="9"
      r="3.6"
      fill="var(--color-gold-light)"
      stroke="var(--color-ink)"
      strokeWidth="1.5"
    />
  </svg>
);

/** A four-point sparkle that twinkles */
const Sparkle: FC<{ className: string; size: number; delay: number }> = ({
  className,
  size,
  delay,
}) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    aria-hidden="true"
    className={cn(
      'absolute z-[3] pointer-events-none animate-twinkle',
      className,
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    <path
      d="M8 1c.6 3.6 1.4 4.4 7 7-5.6 2.6-6.4 3.4-7 7-.6-3.6-1.4-4.4-7-7 5.6-2.6 6.4-3.4 7-7z"
      fill="white"
      stroke="var(--color-ink)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const SIZES = {
  // Thumbnails: just the inner rule and the glint
  sm: { flourish: 0, sparkle: 0, rule: 'inset-[3px]' },
  // Wall polaroids and favorites
  md: { flourish: 30, sparkle: 12, rule: 'inset-[3px]' },
  // A doodle's own page and the judge's dialogue
  lg: { flourish: 46, sparkle: 16, rule: 'inset-[5px]' },
} as const;

type Props = {
  size?: keyof typeof SIZES;
  /** A label for screen readers; leave it out where the score already says it */
  label?: boolean;
};

/**
 * The ornaments that make a frame a masterpiece frame: an inner gold rule,
 * flourishes on the corners, twinkling sparkles and a glint sweeping across.
 * Goes inside a `relative` element that has `goldFrameClass`.
 */
export const GoldTrim: FC<Props> = ({ size = 'md', label = false }) => {
  const s = SIZES[size];
  const f = s.flourish;
  // Hugging the corner, over the frame's outline
  const out = -2;

  return (
    <>
      {label && <span className="sr-only">A perfect 10</span>}
      {/* The inner rule, in deeper gold */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute pointer-events-none border-[1.5px] border-gold-deep',
          s.rule,
        )}
      />
      {/* The glint, kept inside the frame */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-[4] overflow-hidden pointer-events-none"
      >
        <span className="gold-shine" />
      </span>
      {f > 0 && (
        <>
          <Flourish size={f} style={{ top: out, left: out }} />
          <Flourish
            size={f}
            style={{ top: out, right: out }}
            className="rotate-90"
          />
          <Flourish
            size={f}
            style={{ bottom: out, right: out }}
            className="rotate-180"
          />
          <Flourish
            size={f}
            style={{ bottom: out, left: out }}
            className="-rotate-90"
          />
        </>
      )}
      {s.sparkle > 0 && (
        <>
          <Sparkle size={s.sparkle} delay={0} className="-right-2 top-1/3" />
          <Sparkle
            size={s.sparkle * 0.8}
            delay={500}
            className="-left-2 top-2/3"
          />
          <Sparkle
            size={s.sparkle * 0.9}
            delay={900}
            className="left-1/3 -bottom-2"
          />
        </>
      )}
    </>
  );
};
