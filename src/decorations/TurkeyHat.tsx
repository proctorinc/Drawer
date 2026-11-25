import type { FC } from 'react';

// Drawn in a 100×100 box laid over the avatar, so the avatar's edge is a
// circle of radius 50 around (50, 50) and the top of the head is (50, 0).
const ROAST = '#c8762d';
const CRISP = '#9a5320';
const GLAZE = '#eaa65b';
const BONE = '#f6efe0';

const outline = {
  stroke: 'var(--color-ink)',
  strokeWidth: 2,
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;

/** A drumstick pointing straight up from (0, 0), with a paper frill on the bone */
const Drumstick: FC<{ x: number; y: number; tilt: number }> = ({
  x,
  y,
  tilt,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
    <path d="M-2 -28h4v10h-4z" fill={BONE} {...outline} />
    <path
      d="M-4.5 -27l1.5-6 1.5 4 1.5-4 1.5 4 1.5-4 1.5 6z"
      fill="#fff"
      {...outline}
    />
    <path
      d="M-8 4C-10-6-5-17-2-20h4c3 3 8 14 6 24z"
      fill={ROAST}
      {...outline}
    />
    <path
      d="M-4-2C-5-8-3-13-1-16"
      fill="none"
      stroke={GLAZE}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  </g>
);

const WISPS = [
  { x: 40, delay: 0 },
  { x: 58, delay: 1.2 },
];

/** A roast turkey worn as a hat, still steaming */
const TurkeyHat: FC = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    overflow="visible"
    className="absolute inset-0 size-full pointer-events-none"
  >
    <g transform="rotate(-8 50 10)">
      <Drumstick x={20} y={6} tilt={-50} />
      <Drumstick x={80} y={6} tilt={50} />
      {/* The bird, sitting on the head */}
      <path
        d="M14 18C12-4 30-15 50-15s38 11 36 33q-36 9-72 0z"
        fill={ROAST}
        {...outline}
      />
      {/* Crispy underside, a glaze shine and the breastbone */}
      <path d="M17 14q33 8 66 0" fill="none" stroke={CRISP} strokeWidth={3} />
      <path
        d="M24 4C27-5 36-10 44-11"
        fill="none"
        stroke={GLAZE}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M51-14q-2 14 0 28"
        fill="none"
        stroke={CRISP}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {WISPS.map((wisp) => (
        <path
          key={wisp.x}
          d={`M${wisp.x} -18q-3-4 0-8t0-8`}
          fill="none"
          stroke="var(--color-pencil)"
          strokeWidth={1.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            animation: `deco-steam 2.8s ease-out -${wisp.delay}s infinite`,
          }}
        />
      ))}
    </g>
  </svg>
);

export default TurkeyHat;
