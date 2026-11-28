/**
 * A googly eye's pupil, loose inside its dome: gravity drops it to the
 * bottom, moving the sticker throws it around, and it bounces and rolls off
 * the rim. Everything is measured in eye radii, from the eye's middle.
 */
export type Pupil = { x: number; y: number; vx: number; vy: number };

/** How big the pupil is next to the eye */
export const PUPIL_SIZE = 0.55;
// How far the pupil's middle can stray before it hits the rim
const TRAVEL = 1 - PUPIL_SIZE - 0.04;
// Eye radii per second squared: quick enough to swing, slow enough to see
const GRAVITY = 90;
// How fast the air slows it, and the rim as it rolls along it, per second
const AIR_DRAG = 1.2;
const RIM_DRAG = 2.5;
// How much speed a bounce off the rim keeps
const BOUNCE = 0.45;
// Hitting the rim slower than this is resting on it, not bouncing (gravity
// alone adds some speed each step, which mustn't bounce forever)
const BOUNCE_FROM = 1;
// Slower than this at the bottom, it's settled
const SETTLED_SPEED = 0.05;

/** Where a pupil sits before it's had a chance to fall: anywhere inside */
export function loosePupil(random = Math.random): Pupil {
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * TRAVEL;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    vx: 0,
    vy: 0,
  };
}

/**
 * The pupil `dt` seconds on, with the eye itself speeding up by (ax, ay):
 * the pupil lags behind, so it's pushed the other way.
 */
export function stepPupil(pupil: Pupil, dt: number, ax = 0, ay = 0): Pupil {
  const air = Math.exp(-AIR_DRAG * dt);
  let vx = (pupil.vx - ax * dt) * air;
  let vy = (pupil.vy + (GRAVITY - ay) * dt) * air;
  let x = pupil.x + vx * dt;
  let y = pupil.y + vy * dt;

  const distance = Math.hypot(x, y);
  if (distance > TRAVEL) {
    const nx = x / distance;
    const ny = y / distance;
    x = nx * TRAVEL;
    y = ny * TRAVEL;
    // Bounce what was heading out; what runs along the rim rolls on, slowing
    const outward = vx * nx + vy * ny;
    if (outward > 0) {
      const rim = Math.exp(-RIM_DRAG * dt);
      const tx = (vx - outward * nx) * rim;
      const ty = (vy - outward * ny) * rim;
      const resting = Math.max(BOUNCE_FROM, 2 * GRAVITY * dt);
      const back = outward > resting ? outward * BOUNCE : 0;
      vx = tx - back * nx;
      vy = ty - back * ny;
    }
  }
  return { x, y, vx, vy };
}

/** Sitting still at the bottom, so there's nothing left to animate */
export const isSettled = (pupil: Pupil) =>
  Math.hypot(pupil.vx, pupil.vy) < SETTLED_SPEED && pupil.y > TRAVEL * 0.97;

/** Flicks the pupil off in some direction, as if the eye were tapped */
export function flick(pupil: Pupil, random = Math.random): Pupil {
  const angle = random() * Math.PI * 2;
  const speed = 4 + random() * 3;
  return {
    ...pupil,
    vx: pupil.vx + Math.cos(angle) * speed,
    vy: pupil.vy + Math.sin(angle) * speed,
  };
}
