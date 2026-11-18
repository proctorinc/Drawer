import { XMAS_COLORS } from '../useChristmas';
import type { FC } from 'react';
import { cn } from '@/utils';

type Props = {
  /** Number of bulbs across the strand */
  bulbs?: number;
  /** Shifts the color order, so stacked strands don't line up */
  offset?: number;
  className?: string;
};

/**
 * A sagging doodled wire with blinking bulbs. The wire dips once per bulb,
 * so each bulb hangs from the bottom of a dip at any width.
 */
const Lights: FC<Props> = ({ bulbs = 9, offset = 0, className }) => {
  const wave = Array.from({ length: bulbs }, () => 'q5 16 10 0').join(' ');

  return (
    <div aria-hidden="true" className={cn('relative h-8', className)}>
      <svg
        className="absolute inset-x-0 top-0 w-full h-5"
        viewBox={`0 0 ${bulbs * 10} 20`}
        preserveAspectRatio="none"
      >
        <path
          d={`M0 4 ${wave}`}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {Array.from({ length: bulbs }, (_, i) => {
        const color = XMAS_COLORS[(i + offset) % XMAS_COLORS.length];
        return (
          <span
            key={i}
            className="absolute top-3 w-2.5 h-[15px] box-border border-[1.5px] border-ink rounded-[50%_50%_45%_45%/60%_60%_40%_40%] animate-blink"
            style={{
              left: `calc(${((i + 0.5) / bulbs) * 100}% - 5px)`,
              backgroundColor: color,
              boxShadow: `0 2px 10px 1px ${color}`,
              rotate: i % 2 ? '12deg' : '-12deg',
              animationDelay: `${((i + offset) % 3) * 0.6}s`,
            }}
          >
            <span className="absolute -top-1 left-0.5 w-1.5 h-[5px] rounded-[1px] bg-ink" />
          </span>
        );
      })}
    </div>
  );
};

export default Lights;
