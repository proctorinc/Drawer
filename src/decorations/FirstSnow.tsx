import type { CSSProperties, FC } from 'react';

// Drawn in a 100×100 box laid over the avatar, so the avatar's edge is a
// circle of radius 50 around (50, 50). Angles are degrees clockwise from
// 3 o'clock, so 270 is the top of the head.
const point = (degrees: number, radius: number) => {
  const angle = (degrees * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return `${round(50 + radius * Math.cos(angle))} ${round(50 + radius * Math.sin(angle))}`;
};

const FROM = 200;
const TO = 340;
const LUMPS = 5;
const INNER = 46; // the drift's underside rests just inside the outline
const DRIPS = [235, 300]; // where snow drips down the front of the head

/** A puffy drift over the top of the head, with a couple of drips */
const drift = (() => {
  const step = (TO - FROM) / LUMPS;
  let path = `M${point(FROM, INNER)}`;
  for (let i = 1; i <= LUMPS; i++) {
    const end = FROM + i * step;
    // Ends taper back onto the head; the middle stands taller
    const height = i === LUMPS ? INNER : 52;
    path += `Q${point(end - step / 2, 60 + (i % 2) * 3)} ${point(end, height)}`;
  }
  // Back along the underside, bulging down into a drip at each DRIPS angle
  for (const drip of [...DRIPS].reverse()) {
    path += `A${INNER} ${INNER} 0 0 0 ${point(drip + 6, INNER)}`;
    path += `Q${point(drip, INNER - 14)} ${point(drip - 6, INNER)}`;
  }
  return `${path}A${INNER} ${INNER} 0 0 0 ${point(FROM, INNER)}z`;
})();

const FLAKES = [
  { x: 4, y: 22, drift: -4, delay: 0 },
  { x: 96, y: 30, drift: 5, delay: 1.3 },
  { x: 82, y: 4, drift: 3, delay: 2.4 },
];

/** Fresh snow settled on the head, with a few flakes still falling */
const FirstSnow: FC = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    overflow="visible"
    className="absolute inset-0 size-full pointer-events-none"
  >
    <path
      d={drift}
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
    {FLAKES.map((flake, i) => (
      <path
        key={i}
        d={`M${flake.x} ${flake.y - 4}v8M${flake.x - 3.5} ${flake.y - 2}l7 4M${flake.x - 3.5} ${flake.y + 2}l7-4`}
        stroke="var(--color-snow)"
        strokeWidth={1.4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={
          {
            '--drift': `${flake.drift}px`,
            animation: `flurry 3.6s ease-in -${flake.delay}s infinite`,
          } as CSSProperties
        }
      />
    ))}
  </svg>
);

export default FirstSnow;
