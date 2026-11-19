import { rankCardFor } from './rankCards';
import { LevelBadge } from './LevelBadge';
import type { CSSProperties, FC, ReactNode } from 'react';
import { PushPin } from '@/components/PushPin';
import { cn } from '@/utils';

// Twinkles around the card's corners, in px from each edge
const SPARKS: Array<CSSProperties & { delay: number }> = [
  { top: -9, left: -9, delay: 0 },
  { top: -10, right: 26, delay: 1.1 },
  { bottom: -9, right: -9, delay: 0.5 },
  { bottom: -10, left: 34, delay: 1.8 },
];

type Props = {
  /** Undefined while loading: renders the plainest card */
  level: number | undefined;
  /** Stick a push pin in the top, in the rank's color */
  pin?: boolean;
  className?: string;
  /** Classes for the content area (padding, layout) */
  contentClassName?: string;
  children: ReactNode;
};

/**
 * A card dressed for someone's rank: plain paper at the bottom, tinted paper
 * and a colored rim in the middle, dark cards with turning gold or rainbow
 * rims, twinkles and a pulsing outline at the top.
 *
 * Inside, `text-pencil` and the `highlight` swipe pick up the rank's colors,
 * so content written for a white card reads on every rank.
 */
export const RankCard: FC<Props> = ({
  level,
  pin,
  className,
  contentClassName,
  children,
}) => {
  const { tier, card } = rankCardFor(level ?? 1);
  const spins =
    card.rim?.includes('--rank-angle') ||
    card.pattern?.includes('--rank-angle');

  return (
    <div
      data-rank={tier.id}
      className={cn(
        'relative w-full border-2 border-ink rounded-sketch shadow-pencil transition-[background-color] duration-500',
        spins && 'rank-spin',
        tier.glow && 'rank-card-glow',
        className,
      )}
      style={
        {
          background: card.rim ?? card.background,
          padding: card.rim ? card.rimWidth : 0,
          '--glow': tier.glow,
        } as CSSProperties
      }
    >
      <div
        className={cn(
          'relative isolate overflow-hidden rounded-sketch',
          card.rim && 'border-[1.5px] border-ink',
        )}
        style={
          {
            background: card.background,
            color: card.text,
            '--rank-text': card.text,
            '--color-pencil': card.muted,
            '--hl': card.highlight,
          } as CSSProperties
        }
      >
        {card.pattern && (
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{
              background: card.pattern,
              opacity: card.patternOpacity ?? 1,
            }}
          />
        )}
        {tier.sheen && (
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 pointer-events-none overflow-hidden"
          >
            <span className="rank-card-sheen" />
          </span>
        )}
        <div className={cn('relative', contentClassName)}>{children}</div>
      </div>

      {pin && (
        <PushPin
          color={card.pin}
          lean={16}
          className="absolute z-10 -top-[23px] left-1/2 -ml-4"
        />
      )}

      {tier.sparkle &&
        SPARKS.map(({ delay, ...position }, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="rank-spark z-10"
            style={{
              ...position,
              width: 18,
              height: 18,
              animationDelay: `${delay}s`,
              background: tier.holo
                ? '#ffffff'
                : card.text === 'var(--color-ink)'
                  ? card.pin
                  : '#ffe27a',
            }}
          />
        ))}
    </div>
  );
};

/** A big tilted level badge with a LEVEL tag stuck across its bottom */
export const LevelSeal: FC<{ level: number; size: number }> = ({
  level,
  size,
}) => (
  <div className="relative flex-none -rotate-6 animate-drop">
    <LevelBadge level={level} size={size} />
    <span className="absolute left-1/2 -bottom-2 -translate-x-1/2 px-1.5 bg-coral text-white text-xs border-2 border-ink rounded-sketch rotate-3">
      LEVEL
    </span>
  </div>
);
