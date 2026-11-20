/**
 * Scatters for the rank-up's flying bits. Seeded, so a render is pure and the
 * same tier always throws the same confetti.
 */

function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);

export type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  width: number;
  height: number;
  color: string;
  round: boolean;
};

/** Paper confetti raining from above the screen */
export function makeConfetti(
  count: number,
  palette: Array<string>,
  seed: number,
): Array<ConfettiPiece> {
  const rand = seeded(seed);
  // Bigger showers keep falling for longer, in waves
  const spread = Math.min(2.6, 0.6 + count / 50);
  return Array.from({ length: count }, (_, i) => {
    const round = rand() < 0.2;
    const width = round ? between(rand, 7, 10) : between(rand, 7, 11);
    return {
      left: between(rand, -2, 100),
      delay: between(rand, 0, spread),
      duration: between(rand, 2.6, 4.2),
      drift: between(rand, -60, 60),
      spin: between(rand, -540, 540),
      width,
      height: round ? width : between(rand, 11, 17),
      color: palette[i % palette.length],
      round,
    };
  });
}

export type BurstPiece = {
  x: number;
  y: number;
  delay: number;
  spin: number;
  size: number;
  color: string;
};

/** Pieces thrown outward from the badge, in px from its center */
export function makeBurst(
  count: number,
  palette: Array<string>,
  reach: number,
  seed: number,
): Array<BurstPiece> {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + between(rand, -0.2, 0.2);
    const distance = reach * between(rand, 0.55, 1);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: between(rand, 0, 0.12),
      spin: between(rand, -360, 360),
      size: between(rand, 7, 12),
      color: palette[(i * 3) % palette.length],
    };
  });
}

export type Sparkle = {
  x: number;
  y: number;
  size: number;
  delay: number;
};

/** Twinkles sitting in a loose ring around the badge */
export function makeSparkles(
  count: number,
  radius: number,
  seed: number,
): Array<Sparkle> {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + between(rand, -0.3, 0.3);
    const distance = radius * between(rand, 0.75, 1.25);
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: between(rand, 14, 26),
      delay: between(rand, 0, 2.4),
    };
  });
}

/** A stable seed from a tier id */
export function seedFor(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}
