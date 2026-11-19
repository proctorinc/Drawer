import { rankFor } from './ranks';
import type { CSSProperties, FC } from 'react';
import { cn } from '@/utils';

// Where the twinkles sit around the badge, as fractions of its size
const SPARKS = [
  { top: -0.28, left: -0.12, delay: 0 },
  { top: 0.62, left: 0.98, delay: 0.9 },
  { top: -0.18, left: 0.86, delay: 1.7 },
];

type Props = {
  level: number;
  /** Diameter in px */
  size: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * A flat circled level number whose look climbs with rank: plain metal, then
 * faceted gems with glints, then pulsing rings and finally turning rainbow
 * bands. Line weights scale with the badge so tiny ones stay readable.
 */
export const LevelBadge: FC<Props> = ({ level, size, className, style }) => {
  const tier = rankFor(level);
  const digits = String(level).length;
  const fontSize = size * (digits === 1 ? 0.62 : digits === 2 ? 0.54 : 0.44);
  // Ink outline and colored rim both thin out on small badges
  const outline = Math.min(1.5, Math.max(0.75, size * 0.06));
  const rim = tier.ring ? Math.max(1, size * 0.08) : 0;
  const spins = tier.holo || tier.ring?.includes('--rank-angle');

  return (
    <span
      role="img"
      aria-label={`Level ${level}, ${tier.name}`}
      title={`Level ${level} · ${tier.name}`}
      className={cn(
        'rank-badge pointer-events-none relative inline-block flex-none',
        spins && 'rank-spin',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      {tier.glow && (
        <span
          aria-hidden="true"
          className="rank-pulse"
          style={{ borderColor: tier.glow, borderWidth: outline * 1.5 }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full border-solid border-ink"
        style={{
          borderWidth: outline,
          background: tier.ring,
          padding: rim,
        }}
      >
        <span
          className="relative flex items-center justify-center w-full h-full rounded-full overflow-hidden font-accent font-bold leading-none tabular-nums"
          style={{
            background: tier.background,
            color: tier.text,
            fontSize,
            // A hairline of ink between rim and fill, only where there's room
            boxShadow:
              tier.ring && size >= 24
                ? `0 0 0 ${outline / 2}px var(--color-ink)`
                : undefined,
          }}
        >
          {tier.sheen && <span aria-hidden="true" className="rank-sheen" />}
          <span className="relative">{level}</span>
        </span>
      </span>
      {tier.sparkle &&
        SPARKS.map((spark, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="rank-spark"
            style={{
              top: spark.top * size,
              left: spark.left * size,
              width: size * 0.42,
              height: size * 0.42,
              animationDelay: `${spark.delay}s`,
              background: tier.holo ? '#ffffff' : '#ffe27a',
            }}
          />
        ))}
    </span>
  );
};
