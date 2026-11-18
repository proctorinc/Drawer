import type { FC } from 'react';
import { XMAS_COLORS } from '@/events/useChristmas';

// Drawn in a 100×100 box laid over the avatar, so the avatar's edge is a
// circle of radius 50 around (50, 50). The wire is pinned to that edge at
// these angles (degrees clockwise from 3 o'clock) and sags between pins.
const PINS = [10, 38, 66, 94, 122, 150, 178];
const SAG = 9;

const onEdge = (degrees: number) => {
  const angle = (degrees * Math.PI) / 180;
  return { x: 50 + 50 * Math.cos(angle), y: 50 + 50 * Math.sin(angle) };
};

const { wire, bulbs } = (() => {
  const pins = PINS.map(onEdge);
  let path = `M${pins[0].x} ${pins[0].y}`;
  const hangs = [];
  for (let i = 1; i < pins.length; i++) {
    const [a, b] = [pins[i - 1], pins[i]];
    const control = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + SAG };
    path += `Q${control.x} ${control.y} ${b.x} ${b.y}`;
    // Each bulb hangs from the bottom of its dip (the curve's midpoint)
    hangs.push({
      x: (a.x + 2 * control.x + b.x) / 4,
      y: (a.y + 2 * control.y + b.y) / 4,
    });
  }
  return { wire: path, bulbs: hangs };
})();

/** A blinking strand of lights draped around the bottom of the avatar */
const ChristmasLights: FC = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    overflow="visible"
    className="absolute inset-0 size-full pointer-events-none"
  >
    <path
      d={wire}
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
    {bulbs.map(({ x, y }, i) => {
      const color = XMAS_COLORS[i % XMAS_COLORS.length];
      return (
        <g
          key={i}
          transform={`translate(${x} ${y}) rotate(${i % 2 ? 14 : -14})`}
        >
          <rect
            x={-2.2}
            y={-1}
            width={4.4}
            height={3.5}
            rx={0.8}
            fill="var(--color-ink)"
          />
          <ellipse
            cx={0}
            cy={8}
            rx={3.6}
            ry={5.6}
            fill={color}
            stroke="var(--color-ink)"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
            className="animate-blink"
            style={{
              filter: `drop-shadow(0 0 2.5px ${color})`,
              animationDelay: `${(i % 3) * 0.6}s`,
            }}
          />
        </g>
      );
    })}
  </svg>
);

export default ChristmasLights;
