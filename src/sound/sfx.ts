/**
 * Every celebration's sounds, timed to its animation. Built on the engine's
 * synth, so nothing is downloaded. The flavor is a pack opening: little
 * movements get swishes and pops, build-ups get a rising drumroll and a
 * climbing scale, and reveals land on a happy explosion (a boom, a paper
 * popper, confetti crackle and sparkles) with a bright chord or fanfare.
 *
 * Times are seconds and mirror the CSS or Web Animations they go with; when
 * an animation's timing changes, change it here too.
 */

import { hz, play } from './engine';
import type { Cue } from './engine';

// ------------------------------------------------------------ the palette

// Major pentatonic steps, so random sparkles always sound sweet
const PENTA = [0, 2, 4, 7, 9];
const pentatonic = (root: number, index: number) =>
  root +
  12 * Math.floor(index / PENTA.length) +
  PENTA[((index % PENTA.length) + PENTA.length) % PENTA.length];
// The major scale, for climbing runs
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const major = (root: number, index: number) =>
  root + 12 * Math.floor(index / 7) + MAJOR[((index % 7) + 7) % 7];

const C4 = 60;
const C5 = 72;
const C6 = 84;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Air moving: up for things arriving, down for things leaving */
function whoosh(
  c: Cue,
  { at = 0, up = true, length = 0.28, volume = 0.16, pan = 0 } = {},
) {
  c.noise({
    at,
    filter: 'bandpass',
    frequency: up ? 450 : 2600,
    sweepTo: up ? 3400 : 380,
    q: 0.9,
    attack: length * 0.55,
    decay: length * 0.45,
    volume,
    pan,
  });
}

/** A round bubble pop, like a sticker coming off */
function pop(c: Cue, { at = 0, note = C5 + 7, volume = 0.22, pan = 0 } = {}) {
  const f = hz(note);
  c.tone(f * 0.55, {
    at,
    type: 'sine',
    glideTo: f * 1.5,
    glideTime: 0.035,
    attack: 0.002,
    decay: 0.08,
    volume,
    pan,
  });
  c.noise({
    at,
    filter: 'highpass',
    frequency: 3500,
    decay: 0.018,
    volume: volume * 0.35,
    pan,
  });
}

/** Something heavy landing: a stamp, a badge, the boom under a reveal */
function thud(c: Cue, { at = 0, volume = 0.5, low = 46, high = 150 } = {}) {
  c.tone(high, {
    at,
    type: 'sine',
    glideTo: low,
    glideTime: 0.11,
    attack: 0.002,
    decay: 0.28,
    volume,
  });
  c.noise({
    at,
    filter: 'lowpass',
    frequency: 1400,
    sweepTo: 180,
    decay: 0.1,
    volume: volume * 0.55,
  });
}

/** A bell-ish ding: a sine with a quieter octave and a little shine */
function chime(
  c: Cue,
  note: number,
  { at = 0, volume = 0.18, decay = 0.9, wet = 0.45, pan = 0 } = {},
) {
  c.tone(hz(note), {
    at,
    type: 'sine',
    attack: 0.004,
    decay,
    volume,
    wet,
    pan,
  });
  c.tone(hz(note + 12), {
    at,
    type: 'triangle',
    attack: 0.002,
    decay: decay * 0.45,
    volume: volume * 0.3,
    wet,
    pan,
  });
}

/** Notes rung together */
function chord(
  c: Cue,
  notes: Array<number>,
  { at = 0, volume = 0.12, decay = 1.1, wet = 0.4, strum = 0 } = {},
) {
  notes.forEach((note, i) =>
    chime(c, note, {
      at: at + i * strum,
      volume,
      decay,
      wet,
      pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5,
    }),
  );
}

/** A bright sawtooth with an opening filter, a cartoon brass */
function brass(
  c: Cue,
  note: number,
  { at = 0, length = 0.2, volume = 0.13, pan = 0 } = {},
) {
  c.tone(hz(note), {
    at,
    type: 'sawtooth',
    detune: 7,
    attack: 0.025,
    hold: Math.max(0, length - 0.1),
    decay: 0.22,
    volume,
    pan,
    wet: 0.3,
    filter: { from: 500, to: 3800, time: 0.06, q: 1.5 },
    vibrato: length > 0.4 ? { depth: 14, rate: 5.5 } : undefined,
  });
}

/** High twinkles scattered over a stretch, all from the pentatonic */
function sparkle(
  c: Cue,
  { at = 0, length = 0.9, count = 10, root = C6, volume = 0.07 } = {},
) {
  for (let i = 0; i < count; i++) {
    const when = at + (i / count) * length + rand(0, length / count);
    chime(c, pentatonic(root, Math.floor(rand(0, 8))), {
      at: when,
      volume: volume * rand(0.6, 1),
      decay: rand(0.25, 0.5),
      wet: 0.6,
      pan: rand(-0.7, 0.7),
    });
  }
}

/** Paper confetti: a spray of tiny dry ticks, thinning out */
function crackle(
  c: Cue,
  { at = 0, length = 0.7, count = 26, volume = 0.1 } = {},
) {
  for (let i = 0; i < count; i++) {
    const u = (i / count) ** 1.7;
    c.noise({
      at: at + u * length + rand(0, 0.02),
      filter: 'bandpass',
      frequency: rand(2500, 7000),
      q: 3,
      attack: 0.001,
      decay: rand(0.008, 0.02),
      volume: volume * (1 - u * 0.6) * rand(0.6, 1),
      pan: rand(-0.8, 0.8),
    });
  }
}

/** Fast pencil scratching, for ticking a box */
function scribble(c: Cue, { at = 0, length = 0.35, volume = 0.1 } = {}) {
  const strokes = 3;
  for (let i = 0; i < strokes; i++) {
    c.noise({
      at: at + (i * length) / strokes,
      filter: 'bandpass',
      frequency: 2200 + i * 500,
      sweepTo: 3600 + i * 400,
      q: 2,
      attack: 0.02,
      decay: length / strokes,
      volume,
    });
  }
}

/** A snare roll speeding up: the drumroll before a reveal */
function drumroll(
  c: Cue,
  { at = 0, length = 1, volume = 0.13, from = 0.11, to = 0.028 } = {},
) {
  let t = 0;
  let i = 0;
  while (t < length) {
    const u = t / length;
    c.noise({
      at: at + t,
      filter: 'bandpass',
      frequency: 1800 + u * 1600,
      q: 0.8,
      attack: 0.002,
      decay: 0.06,
      // Crescendo, with a little accent on alternate hits
      volume: volume * (0.35 + 0.65 * u) * (i % 2 ? 0.8 : 1),
      pan: i % 2 ? 0.12 : -0.12,
    });
    t += from + (to - from) * u;
    i++;
  }
}

/**
 * The build-up before a big reveal: a sawtooth swelling and climbing with its
 * filter opening, a scale stepping up faster and faster (the pack-opening
 * climb) and a drumroll underneath. `intensity` 0–1 makes it bigger.
 */
function riser(
  c: Cue,
  { at = 0, length = 1.2, intensity = 0.5, root = C4 } = {},
) {
  c.tone(hz(root - 12), {
    at,
    type: 'sawtooth',
    detune: 12,
    glideTo: hz(root + 12),
    attack: length * 0.95,
    decay: 0.08,
    volume: 0.06 + 0.06 * intensity,
    filter: { from: 260, to: 2400 + 2600 * intensity, time: length, q: 3 },
  });
  // A high shimmer coming in on top for the bigger ones
  if (intensity > 0.35) {
    c.noise({
      at,
      filter: 'highpass',
      frequency: 1500,
      sweepTo: 9000,
      attack: length * 0.95,
      decay: 0.05,
      volume: 0.03 + 0.05 * intensity,
    });
  }
  drumroll(c, {
    at,
    length,
    volume: 0.07 + 0.09 * intensity,
    from: 0.14,
    to: 0.03 - 0.008 * intensity,
  });
  // The climb: notes spaced so they pile up toward the end
  const steps = Math.round(8 + 8 * intensity);
  for (let i = 0; i < steps; i++) {
    const u = 1 - (1 - i / steps) ** 1.6;
    c.tone(hz(major(root, i)), {
      at: at + u * length,
      type: 'square',
      attack: 0.003,
      decay: 0.09,
      volume: 0.035 + (0.04 * i) / steps,
      filter: { from: 1800, to: 900, time: 0.08 },
      pan: (i % 2 ? 0.2 : -0.2) * intensity,
    });
  }
}

/**
 * A happy explosion: a deep boom, a party popper's crack, confetti crackling
 * down and sparkles over the top. `size` 0–1.
 */
function explosion(c: Cue, { at = 0, size = 0.5 } = {}) {
  thud(c, { at, volume: 0.45 + 0.35 * size, low: 38, high: 170 });
  // The popper's crack
  c.noise({
    at,
    filter: 'highpass',
    frequency: 900,
    decay: 0.05,
    volume: 0.35 + 0.15 * size,
  });
  // The rush of air and paper, opening and falling away
  c.noise({
    at,
    filter: 'lowpass',
    frequency: 9000,
    sweepTo: 350,
    attack: 0.004,
    decay: 0.45 + 0.4 * size,
    volume: 0.22 + 0.15 * size,
    wet: 0.3,
  });
  crackle(c, {
    at: at + 0.04,
    length: 0.6 + 0.6 * size,
    count: Math.round(18 + 30 * size),
    volume: 0.08 + 0.06 * size,
  });
  sparkle(c, {
    at: at + 0.08,
    length: 0.8 + 0.8 * size,
    count: Math.round(6 + 14 * size),
    volume: 0.05 + 0.04 * size,
  });
}

// -------------------------------------------------------------- movements

/** A card or sheet arriving */
export const cardIn = () => play((c) => whoosh(c, { length: 0.26 }));

/** A card or sheet going */
export const cardOut = () =>
  play((c) => whoosh(c, { up: false, length: 0.2, volume: 0.1 }));

/** Turning a page, left or right */
export const pageFlip = (direction: 1 | -1) =>
  play((c) => {
    whoosh(c, { length: 0.18, volume: 0.12, pan: direction * 0.4 });
    c.noise({
      at: 0.13,
      filter: 'bandpass',
      frequency: 3000,
      q: 1.5,
      decay: 0.03,
      volume: 0.1,
      pan: direction * 0.4,
    });
  });

/** Picking a reaction sticker: a pop that rises with which one it is */
export const reactionPop = (index: number, adding: boolean) =>
  play((c) => {
    if (adding) {
      pop(c, { note: pentatonic(C5, index + 2), volume: 0.22 });
      chime(c, pentatonic(C6, index + 2), { at: 0.05, volume: 0.05 });
    } else {
      pop(c, { note: pentatonic(C4 + 12, index), volume: 0.12 });
    }
  });

// ----------------------------------------------------------- the XP card

/** The XP card dropping in from the top */
export const xpIn = () =>
  play((c) => {
    whoosh(c, { length: 0.3, volume: 0.13 });
    pop(c, { at: 0.24, note: C5, volume: 0.1 });
  });

/** One notch of the bar filling; pitch climbs with the fill (0–1) */
export const xpTick = (frac: number) =>
  play((c) => {
    const note = pentatonic(C5, Math.round(frac * 9));
    c.tone(hz(note), {
      type: 'triangle',
      attack: 0.002,
      decay: 0.07,
      volume: 0.11,
      pan: (frac - 0.5) * 0.6,
    });
  });

/** The bar reaching a new level: a quick bright arpeggio and a ding */
export const xpLevelUp = () =>
  play((c) => {
    [C5, C5 + 4, C5 + 7].forEach((note, i) =>
      c.tone(hz(note), {
        at: i * 0.055,
        type: 'square',
        attack: 0.003,
        decay: 0.12,
        volume: 0.06,
        filter: { from: 3000, to: 1200, time: 0.1 },
      }),
    );
    chime(c, C6, { at: 0.17, volume: 0.17 });
    sparkle(c, { at: 0.2, length: 0.4, count: 4, volume: 0.05 });
  });

/** Crossing into a new rank on the little card: bigger than a level */
export const xpTierUp = () =>
  play((c) => {
    pop(c, { note: C5, volume: 0.18 });
    chord(c, [C5, C5 + 4, C5 + 7, C6], { at: 0.05, strum: 0.04, volume: 0.1 });
    crackle(c, { at: 0.05, length: 0.4, count: 12, volume: 0.07 });
    sparkle(c, { at: 0.12, length: 0.6, count: 7 });
  });

/** The count finishing: a little coin-like "ka-ching" */
export const xpLand = () =>
  play((c) => {
    chime(c, C6 + 7, { volume: 0.09, decay: 0.3 });
    chime(c, C6 + 12, { at: 0.07, volume: 0.11, decay: 0.6 });
  });

/** The XP card going back up */
export const xpOut = () =>
  play((c) => whoosh(c, { up: false, length: 0.22, volume: 0.07 }));

// -------------------------------------------------------- progress ticker

export const tickerIn = () =>
  play((c) => pop(c, { note: C5 + 2, volume: 0.12 }));

/** The count bumping up; pitch climbs toward the goal */
export const tickerCount = (count: number, goal: number) =>
  play((c) =>
    c.tone(hz(pentatonic(C5, Math.round((count / Math.max(1, goal)) * 7))), {
      type: 'triangle',
      attack: 0.002,
      decay: 0.08,
      volume: 0.09,
    }),
  );

/** Hitting the goal on the ticker */
export const tickerComplete = () =>
  play((c) => {
    chime(c, C6, { volume: 0.12 });
    chime(c, C6 + 7, { at: 0.08, volume: 0.12 });
  });

// ------------------------------------------------------------ completed card

/**
 * The sticker, achievement or quest card, timed to completed.css: the card
 * swings in, the art drops like a rubber stamp and thunks the card at 0.62s
 * as the paper bits burst, then a little "unlocked" jingle. A quest instead
 * scribbles its tick at 0.7s, bursts at 0.95s and stamps "done!" at ~1.2s.
 */
export function completedCard(kind: 'sticker' | 'achievement' | 'quest') {
  return play((c) => {
    whoosh(c, { length: 0.3, volume: 0.14 });
    if (kind === 'quest') {
      scribble(c, { at: 0.7, length: 0.3 });
      explosion(c, { at: 0.95, size: 0.15 });
      thud(c, { at: 1.2, volume: 0.35, high: 220, low: 70 });
      [C5, C5 + 4, C5 + 7, C6].forEach((note, i) =>
        chime(c, note, { at: 1.0 + i * 0.07, volume: 0.11, decay: 0.5 }),
      );
      return;
    }
    // The stamp falling, a quick whistle down
    c.tone(hz(C6 + 7), {
      at: 0.35,
      type: 'sine',
      glideTo: hz(C5),
      attack: 0.05,
      decay: 0.2,
      volume: 0.04,
    });
    thud(c, { at: 0.62, volume: 0.5 });
    explosion(c, { at: 0.62, size: 0.25 });
    const root = kind === 'sticker' ? C5 + 5 : C5;
    [0, 4, 7, 12].forEach((step, i) =>
      chime(c, root + step, {
        at: 0.7 + i * 0.075,
        volume: 0.12,
        decay: i === 3 ? 1 : 0.45,
      }),
    );
    // The +XP chip and buttons rising in
    pop(c, { at: 0.95, note: C6, volume: 0.07 });
  });
}

// ------------------------------------------------------------ reward reveal

/**
 * The present, timed to completed.css: the box shivers from 0.3s while a
 * drumroll builds, the lid pops off at ~0.9s, and the prize springs out at
 * 1.15s into a big happy explosion and a major chord, with sparkles as the
 * name rises at 1.5s.
 */
export function rewardReveal() {
  return play((c) => {
    whoosh(c, { length: 0.3, volume: 0.12 });
    thud(c, { at: 0.12, volume: 0.25, high: 120, low: 60 });
    // The rattle of the shake: little knocks against the table
    [0.3, 0.4, 0.5, 0.6, 0.7].forEach((at, i) =>
      c.noise({
        at,
        filter: 'bandpass',
        frequency: 700 + i * 60,
        q: 2,
        attack: 0.002,
        decay: 0.05,
        volume: 0.14,
        pan: i % 2 ? 0.25 : -0.25,
      }),
    );
    riser(c, { at: 0.25, length: 0.65, intensity: 0.35, root: C4 + 7 });
    // The lid: a cork-like pop and a whoosh as it tumbles away
    pop(c, { at: 0.9, note: C5 + 12, volume: 0.25 });
    whoosh(c, { at: 0.92, length: 0.35, volume: 0.12, pan: 0.5 });
    // The prize!
    explosion(c, { at: 1.18, size: 0.75 });
    brass(c, C5, { at: 1.2, length: 0.12, volume: 0.09 });
    brass(c, C5 + 4, { at: 1.3, length: 0.12, volume: 0.09 });
    brass(c, C5 + 7, { at: 1.4, length: 0.6, volume: 0.1 });
    chord(c, [C4 + 12, C5 + 4, C5 + 7, C6], {
      at: 1.4,
      volume: 0.08,
      decay: 1.6,
    });
    // The box falling away
    whoosh(c, { at: 1.25, up: false, length: 0.35, volume: 0.07 });
    sparkle(c, { at: 1.5, length: 0.9, count: 8, volume: 0.05 });
  });
}

// ---------------------------------------------------------- pin ceremony

/** The canvas lifting into a polaroid: a paper flutter and a soft settle */
export const pinLift = () =>
  play((c) => {
    whoosh(c, { length: 0.35, volume: 0.1 });
    c.noise({
      at: 0.05,
      filter: 'bandpass',
      frequency: 1800,
      q: 1.2,
      attack: 0.08,
      decay: 0.25,
      volume: 0.06,
    });
    thud(c, { at: 0.6, volume: 0.12, high: 110, low: 60 });
  });

/** The pin falling in: a cartoon whistle down, `seconds` long */
export const pinDrop = (seconds: number) =>
  play((c) => {
    c.tone(hz(C6 + 12), {
      type: 'sine',
      glideTo: hz(C6 - 3),
      attack: seconds * 0.5,
      decay: seconds * 0.5,
      volume: 0.05,
    });
  });

/** Tack! A sharp click, a knock and a little metal ting */
export const pinTack = () =>
  play((c) => {
    c.noise({
      filter: 'highpass',
      frequency: 2500,
      decay: 0.02,
      volume: 0.35,
    });
    thud(c, { volume: 0.4, high: 260, low: 90 });
    c.tone(hz(C6 + 19), {
      at: 0.005,
      type: 'sine',
      attack: 0.002,
      decay: 0.35,
      volume: 0.05,
      wet: 0.4,
    });
  });

/** The polaroid swinging on its pin, softer each way, over `seconds` */
export const pinSwing = (seconds: number) =>
  play((c) => {
    const swings = 6;
    for (let i = 0; i < swings; i++) {
      const fade = 1 - i / swings;
      c.noise({
        at: (i * seconds) / swings,
        filter: 'bandpass',
        frequency: 700 + (i % 2) * 250,
        sweepTo: 1300 + (i % 2) * 200,
        q: 1.2,
        attack: 0.12,
        decay: 0.18,
        volume: 0.06 * fade,
        pan: i % 2 ? 0.35 : -0.35,
      });
    }
  });

/** Settled on the wall: two notes, "pinned!" */
export const pinSettled = () =>
  play((c) => {
    chime(c, C5 + 7, { volume: 0.1, decay: 0.4 });
    chime(c, C6, { at: 0.09, volume: 0.12, decay: 0.8 });
  });

// ------------------------------------------------------------------ rank up

export type RankUpSound = {
  /** Plays what goes with a beat of the animation */
  beat: (name: 'wash' | 'old' | 'turn' | 'new' | 'stamp' | 'ready') => void;
  /** Fades out whatever's still going */
  stop: () => void;
};

export type RankUpShape = {
  /** 0 for the lowest tier, 1 for the highest */
  intensity: number;
  /** The animation's pace; >1 is slower and grander */
  pace: number;
  reveal: 'flip' | 'crack';
  confetti: boolean;
  sparkles: boolean;
  sweep: boolean;
  /** Seconds from the old badge landing to the new one */
  buildUp: number;
};

/**
 * The rank-up's score, beat by beat. A low swell as the color floods in, a
 * knock as the old badge lands, then the build-up: a rising saw, a scale
 * climbing faster and faster and a drumroll, longer and louder the higher
 * the tier. It cuts dead as the badge flips or cracks open into a happy
 * explosion and a chord, and the name stamp brings a fanfare, confetti and
 * sparkles. Champion and Mythic get a second, higher phrase.
 */
export function rankUpSound(shape: RankUpShape): RankUpSound {
  const { intensity: k, reveal } = shape;
  const cues: Array<Cue> = [];
  let build: Cue | null = null;
  const keep = (c: Cue | null) => {
    if (c) cues.push(c);
    return c;
  };
  // Each tier up lifts the key a little, so climbing the ranks feels it
  const root = C4 + Math.round(k * 5);

  return {
    beat(name) {
      if (name === 'wash') {
        keep(
          play((c) => {
            c.tone(hz(root - 24), {
              type: 'sawtooth',
              detune: 10,
              attack: 0.35,
              decay: 1.1,
              volume: 0.08 + 0.06 * k,
              filter: { from: 150, to: 900, time: 0.4, q: 2 },
            });
            whoosh(c, { length: 0.6, volume: 0.12 });
          }),
        );
      }
      if (name === 'old') {
        keep(
          play((c) => {
            whoosh(c, { up: false, length: 0.25, volume: 0.1 });
            thud(c, { at: 0.2, volume: 0.35, high: 130, low: 55 });
            chime(c, root, { at: 0.22, volume: 0.07, decay: 0.5 });
          }),
        );
        build = keep(
          play((c) =>
            riser(c, {
              at: 0.25,
              length: Math.max(0.6, shape.buildUp - 0.25),
              intensity: 0.3 + 0.7 * k,
              root,
            }),
          ),
        );
      }
      if (name === 'turn') {
        keep(
          play((c) => {
            if (reveal === 'flip') {
              whoosh(c, { length: 0.3, volume: 0.15 });
              return;
            }
            // The crack running down the badge: sharp snaps and a rattle
            for (let i = 0; i < 6; i++) {
              c.noise({
                at: 0.08 + i * 0.045,
                filter: 'highpass',
                frequency: rand(1800, 4500),
                attack: 0.001,
                decay: rand(0.015, 0.04),
                volume: 0.18 + 0.08 * k,
                pan: rand(-0.3, 0.3),
              });
            }
            thud(c, { at: 0.08, volume: 0.2, high: 200, low: 90 });
          }),
        );
      }
      if (name === 'new') {
        // The drop: the build-up cuts out as the badge bursts open
        build?.stop(0.03);
        build = null;
        keep(
          play((c) => {
            explosion(c, { size: 0.45 + 0.55 * k });
            if (reveal === 'crack') {
              // Shards of glass flying off
              for (let i = 0; i < 6 + 10 * k; i++) {
                chime(c, pentatonic(C6 + 12, Math.floor(rand(0, 6))), {
                  at: rand(0, 0.35),
                  volume: 0.035,
                  decay: 0.2,
                  pan: rand(-0.9, 0.9),
                });
              }
            }
            chord(c, [root, root + 7, root + 12, root + 16], {
              at: 0.02,
              volume: 0.08 + 0.04 * k,
              decay: 1.6,
              strum: 0.012,
            });
          }),
        );
      }
      if (name === 'stamp') {
        keep(
          play((c) => {
            thud(c, { at: 0.2, volume: 0.55 });
            const r = root + 12;
            // Pickups, then the held note over its chord
            brass(c, r - 5, { at: 0.24, length: 0.1 });
            brass(c, r - 5, { at: 0.36, length: 0.1 });
            brass(c, r, { at: 0.48, length: 0.65 + 0.3 * k, volume: 0.15 });
            chord(c, [r - 12, r - 5, r + 4], {
              at: 0.48,
              volume: 0.07,
              decay: 1.8,
            });
            if (k > 0.7) {
              // The top tiers climb on for a second, higher phrase
              brass(c, r + 4, { at: 1.15, length: 0.12 });
              brass(c, r + 7, { at: 1.28, length: 0.12 });
              brass(c, r + 12, { at: 1.41, length: 0.9, volume: 0.15 });
              thud(c, { at: 1.41, volume: 0.4 });
              chord(c, [r, r + 7, r + 16], {
                at: 1.41,
                volume: 0.07,
                decay: 2,
              });
            }
            if (shape.sweep) whoosh(c, { at: 0.25, length: 0.9, volume: 0.1 });
            if (shape.confetti) {
              crackle(c, {
                at: 0.3,
                length: 1.4,
                count: Math.round(20 + 30 * k),
                volume: 0.06,
              });
            }
            if (shape.sparkles || k > 0.3) {
              sparkle(c, {
                at: 0.5,
                length: 1.6,
                count: Math.round(6 + 16 * k),
              });
            }
          }),
        );
      }
      if (name === 'ready') {
        keep(play((c) => pop(c, { note: C6, volume: 0.08 })));
      }
    },
    stop() {
      cues.forEach((c) => c.stop(0.6));
    },
  };
}
