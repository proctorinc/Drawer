import './completed.css';
import type { CSSProperties, FC } from 'react';

const COLORS = [
  'var(--color-coral)',
  'var(--color-butter)',
  'var(--color-sky)',
  'var(--color-blush)',
  'var(--color-xmas-green)',
];

// Fixed spread so every burst looks the same and renders stay pure
const BITS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.15);
  const reach = 70 + ((i * 37) % 50);
  return {
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.8),
    spin: (i % 2 ? 1 : -1) * (120 + ((i * 53) % 200)),
    color: COLORS[i % COLORS.length],
    wide: i % 3 === 0,
  };
});

/** Hard-edged paper confetti bursting out from the middle of its parent */
const PaperBits: FC<{ delay?: number }> = ({ delay }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 grid place-items-center"
  >
    {BITS.map((bit, i) => (
      <span
        key={i}
        className="completed-bit col-start-1 row-start-1 border-[1.5px] border-ink"
        style={
          {
            '--dx': `${bit.dx}px`,
            '--dy': `${bit.dy}px`,
            '--spin': `${bit.spin}deg`,
            width: bit.wide ? 12 : 7,
            height: bit.wide ? 6 : 9,
            background: bit.color,
            animationDelay: delay === undefined ? undefined : `${delay}s`,
          } as CSSProperties
        }
      />
    ))}
  </span>
);

export default PaperBits;
