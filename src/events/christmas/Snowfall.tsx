import type { CSSProperties } from 'react';

// Fixed, deterministic flakes so the pattern doesn't reshuffle on re-render
const FLAKES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  size: 8 + ((i * 7) % 9),
  drift: ((i * 29) % 40) - 20,
  duration: 7 + ((i * 13) % 8),
  delay: (i * 17) % 11,
  opacity: 0.55 + ((i * 11) % 4) / 10,
}));

/** Doodled snowflakes drifting down behind the page content */
const Snowfall = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 overflow-hidden pointer-events-none"
  >
    {FLAKES.map((flake, i) => (
      <svg
        key={i}
        width={flake.size}
        height={flake.size}
        viewBox="0 0 12 12"
        className="absolute top-0"
        style={
          {
            left: `${flake.left}%`,
            opacity: flake.opacity,
            '--drift': `${flake.drift}px`,
            // Negative delay starts each flake mid-fall instead of all at the top
            animation: `snowfall ${flake.duration}s linear -${flake.delay}s infinite`,
          } as CSSProperties
        }
      >
        <path
          d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5"
          stroke="var(--color-snow)"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </svg>
    ))}
  </div>
);

export default Snowfall;
