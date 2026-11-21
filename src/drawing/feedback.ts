/**
 * The feel of drawing: a light buzz under the finger, a pencil-on-paper
 * scratch that follows how fast you move, specks flicking off the tip, and
 * little clicks for the toolbar. All of it is best effort: whatever the
 * browser can't do is skipped quietly.
 */

import { getFeedbackSettings } from './feedbackSettings';

// ---------------------------------------------------------------- haptics

const hasWindow = typeof window !== 'undefined';
// Test environments and older browsers may not have matchMedia
const matches = (query: string) =>
  hasWindow &&
  (window as { matchMedia?: typeof window.matchMedia }).matchMedia?.(query)
    .matches === true;
const isCoarse = matches('(pointer: coarse)');
// Not every browser has vibrate (iOS Safari doesn't), whatever the types say.
// Desktop Chrome has it with no motor behind it, so it only counts on a
// device held in the hand.
const canVibrate = hasWindow && 'vibrate' in navigator && isCoarse;
// iPhones tick through a switch from iOS 18 on (see iosTick); iPads have no
// motor at all, and say iPad or pass as a Mac in their user agent
const iPhoneVersion = hasWindow
  ? Number(/iPhone OS (\d+)_/.exec(navigator.userAgent)?.[1] ?? 0)
  : 0;
const canTick = !canVibrate && isCoarse && iPhoneVersion >= 18;
/**
 * Whether this device can buzz at all. Browsers can't say whether there's a
 * motor, so this is the best guess: a phone with vibrate, or an iPhone.
 */
export const canBuzz = canVibrate || canTick;

// By level, 0 (none) to 4. A buzz lasts longer the higher it goes; the
// iPhone's tick can't get stronger, so ticks under a moving finger also come
// closer together (and Android's too, so the levels feel alike)
const BUZZ_LENGTH = [0, 0.5, 0.75, 1, 1.6];
const BUZZ_SPACING = [0, 2.2, 1.5, 1, 0.75];
// Times the master volume
const SOUND_VOLUME = [0, 0.3, 0.6, 1, 1.5];

const vibrateLevel = () => getFeedbackSettings().vibrate;
const soundLevel = () => getFeedbackSettings().sound;

let iosSwitch: HTMLLabelElement | null = null;

/**
 * iOS Safari has no vibrate, but since iOS 18 toggling a switch checkbox
 * plays the system's selection tick, so keep a hidden one to flick
 */
function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.dataset.sound = 'off';
    label.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    // Its clicks are ours; keep them from reaching the app's own handlers
    label.addEventListener('click', (event) => event.stopPropagation());
    iosSwitch = label;
  }
  // A modal dialog makes the rest of the page inert, so the switch has to
  // live inside one while it's open (as when trying out the settings)
  const parent = document.querySelector('dialog:modal') ?? document.body;
  if (iosSwitch.parentElement !== parent) parent.appendChild(iosSwitch);
  iosSwitch.click();
}

/** A tap of feedback, for devices held in the hand */
function buzz(ms: number) {
  const level = vibrateLevel();
  if (!hasWindow || level === 0) return;
  if (canVibrate) {
    try {
      navigator.vibrate(Math.max(1, Math.round(ms * BUZZ_LENGTH[level])));
    } catch {
      // Blocked (no user gesture yet, or turned off): fine
    }
  } else if (canTick) {
    iosTick();
  }
}

// ------------------------------------------------------------------ sound

let audio: AudioContext | null = null;
let master: GainNode | null = null;
/** Send to a soft echo, so musical notes hang in the air a moment */
let space: GainNode | null = null;
let grainBuffer: AudioBuffer | null = null;

function getAudio(): AudioContext | null {
  if (!hasWindow) return null;
  if (!audio) {
    // Older Safari only has the prefixed one, whatever the types say
    const loose = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = loose.AudioContext ?? loose.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
    } catch {
      return null;
    }
    master = audio.createGain();
    master.connect(audio.destination);
    space = audio.createGain();
    space.gain.value = 0.14;
    const delay = audio.createDelay(1);
    delay.delayTime.value = 0.31;
    const echo = audio.createGain();
    echo.gain.value = 0.25;
    // Each repeat a little duller than the last
    const damp = audio.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1400;
    space.connect(delay).connect(damp).connect(echo).connect(delay);
    damp.connect(master);
  }
  if (master) master.gain.value = 0.6 * SOUND_VOLUME[soundLevel()];
  if (audio.state === 'suspended') void audio.resume().catch(() => {});
  return audio;
}

// Browsers only let sound start from a tap or click, and on phones a finger
// going down doesn't count yet (lifting it does), so wake the audio on the
// page's first few touches rather than waiting for a stroke to end
if (hasWindow) {
  const unlock = () => {
    const ctx = getAudio();
    if (ctx?.state === 'running') {
      for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
        window.removeEventListener(type, unlock, true);
      }
    }
  };
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, unlock, true);
  }
}

/** Soft noise with the odd faint catch, for the brush under the tip */
function getGrain(ctx: AudioContext) {
  if (grainBuffer && grainBuffer.sampleRate === ctx.sampleRate)
    return grainBuffer;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let catchLeft = 0;
  let catchLevel = 0;
  for (let i = 0; i < length; i++) {
    if (catchLeft <= 0 && Math.random() < 0.0006) {
      catchLeft = Math.floor(ctx.sampleRate * (0.003 + Math.random() * 0.008));
      catchLevel = 0.35 + Math.random() * 0.25;
    }
    const level = catchLeft-- > 0 ? catchLevel : 0.25;
    data[i] = (Math.random() * 2 - 1) * level;
  }
  grainBuffer = buffer;
  return buffer;
}

/**
 * How worn-in the sound is, 0 to 1. It climbs while you keep drawing and
 * eases back while you rest, so filling a big patch quiets down to a murmur
 * instead of droning, and the first stroke after a pause sounds fresh.
 */
let tire = 0;
let lastActive = 0;
const TIRE_AFTER_MS = 10000;
const REST_MS = 1800;

/** A low, quiet brush that breathes with how fast the tip moves */
type Brush = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  eraser: boolean;
};

function startBrush(eraser: boolean): Brush | null {
  if (soundLevel() === 0) return null;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return null;
  const source = ctx.createBufferSource();
  source.buffer = getGrain(ctx);
  source.loop = true;
  // Start somewhere new in the loop so strokes don't all sound alike
  const offset = Math.random() * source.buffer.duration;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 160;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = eraser ? 300 : 550;
  filter.Q.value = 0.4;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(highpass).connect(filter).connect(gain).connect(master);
  source.start(ctx.currentTime, offset);
  return { source, filter, gain, eraser };
}

function setBrush(brush: Brush, speed: number) {
  const ctx = brush.source.context;
  // Speed is in CSS pixels per millisecond; a brisk stroke is around 1.5.
  // The root keeps slow strokes audible without fast ones shouting.
  const amount = Math.sqrt(Math.min(1, speed / 1.8));
  const loud = amount * (1 - 0.65 * tire) * (brush.eraser ? 0.16 : 0.12);
  const now = ctx.currentTime;
  brush.gain.gain.setTargetAtTime(loud, now, 0.12);
  brush.filter.frequency.setTargetAtTime(
    brush.eraser ? 300 + amount * 500 : 550 + amount * 900,
    now,
    0.15,
  );
}

function stopBrush(brush: Brush) {
  const ctx = brush.source.context;
  const now = ctx.currentTime;
  brush.gain.gain.cancelScheduledValues(now);
  brush.gain.gain.setTargetAtTime(0, now, 0.06);
  brush.source.stop(now + 0.4);
}

/** Each pencil sounds a touch different: a nudge to its brightness */
function toneFor(color: string) {
  let hash = 0;
  for (const char of color) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 7) - 3) / 3;
}

/**
 * A pencil's little emphasis as it digs in for a moment: a short swell of
 * grain that sweeps down as the tip slows, with a catch or two in the paper.
 * No two are quite alike.
 */
function scritch(
  volume: number,
  { pan = 0, tone = 0, length = 0.08 + Math.random() * 0.07 } = {},
) {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  const end = start + length;

  // Older Safari has no panner; it just sits in the middle there
  const panner = 'createStereoPanner' in ctx ? ctx.createStereoPanner() : null;
  if (panner) {
    panner.pan.value = pan;
    panner.connect(master);
  }
  const out = panner ?? master;

  const source = ctx.createBufferSource();
  source.buffer = getGrain(ctx);
  const center = (1100 + Math.random() * 800) * (1 + tone * 0.12);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(center, start);
  band.frequency.exponentialRampToValueAtTime(center * 0.72, end);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + length * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(band).connect(gain).connect(out);
  source.start(start, Math.random() * 1.5);
  source.stop(end + 0.02);

  // The odd tiny catch of graphite on the tooth of the paper
  const catches = Math.floor(Math.random() * 3);
  for (let i = 0; i < catches; i++) {
    const at = start + length * (0.15 + Math.random() * 0.6);
    const click = ctx.createBufferSource();
    click.buffer = getGrain(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2600 + Math.random() * 1200;
    hp.Q.value = 2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(volume * 0.55, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
    click.connect(hp).connect(env).connect(out);
    click.start(at, Math.random() * 1.5);
    click.stop(at + 0.02);
  }
}

/** A pencil tip landing: a dry tick with a little knock of the table under it */
function tap(volume: number, pan = 0) {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  puff(2400, { volume: volume * 0.8, duration: 0.018, q: 1.6 });
  const knock = ctx.createOscillator();
  knock.type = 'sine';
  knock.frequency.setValueAtTime(190, start);
  knock.frequency.exponentialRampToValueAtTime(120, start + 0.05);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume * 0.6, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
  const panner = 'createStereoPanner' in ctx ? ctx.createStereoPanner() : null;
  if (panner) panner.pan.value = pan;
  knock.connect(gain);
  if (panner) gain.connect(panner).connect(master);
  else gain.connect(master);
  knock.start(start);
  knock.stop(start + 0.08);
}

/**
 * A soft, warm note: a triangle through a filter that closes as it fades,
 * over a quiet sine an octave down. Felt on wood more than a bell.
 */
function note(
  frequency: number,
  { volume = 0.05, ring = 1.2, pan = 0, tone = 0 } = {},
) {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || !space || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  const end = start + ring;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, start);
  out.gain.exponentialRampToValueAtTime(volume, start + 0.022);
  out.gain.exponentialRampToValueAtTime(volume * 0.35, start + 0.25);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  const bright = frequency * (2.6 + tone * 0.4);
  filter.frequency.setValueAtTime(bright, start);
  filter.frequency.exponentialRampToValueAtTime(frequency * 1.1, end);
  // Older Safari has no panner; it just sits in the middle there
  const panner = 'createStereoPanner' in ctx ? ctx.createStereoPanner() : null;
  if (panner) panner.pan.value = pan;
  filter.connect(out);
  const tail = panner ? out.connect(panner) : out;
  tail.connect(master);
  tail.connect(space);
  for (const [type, ratio, level] of [
    ['triangle', 1, 1],
    ['sine', 0.5, 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency * ratio;
    const partial = ctx.createGain();
    partial.gain.value = level;
    osc.connect(partial).connect(filter);
    osc.start(start);
    osc.stop(end + 0.05);
  }
}

// An open pentatonic (no major third, so it reads calm rather than cute),
// two octaves up from A3
const SCALE = [0, 2, 5, 7, 9, 12, 14, 17, 19, 21];
const BASE_HZ = 220;
let lastStep = Math.floor(SCALE.length / 2);

/**
 * A note from where the tip is: higher up the page is higher in pitch. It
 * steps toward that pitch rather than leaping, and never repeats itself, so
 * a stroke draws out a slow line of melody.
 */
function strokeNote(
  x: number,
  y: number,
  color: string,
  volume: number,
  ring = 1.2,
) {
  const up = 1 - Math.min(1, Math.max(0, y / (window.innerHeight || 1)));
  const target = Math.round(up * (SCALE.length - 1));
  let step = lastStep + Math.max(-2, Math.min(2, target - lastStep));
  if (step === lastStep) {
    step +=
      step >= SCALE.length - 1 || (step > 0 && Math.random() < 0.5) ? -1 : 1;
  }
  lastStep = step;
  note(BASE_HZ * 2 ** (SCALE[step] / 12), {
    volume,
    ring,
    pan: panFor(x),
    tone: toneFor(color),
  });
}

// ------------------------------------------------------------ sound styles

/** Which sound the pencils make; set for everyone by an admin */
export type PencilSound = 'pencil' | 'musical';
export const PENCIL_SOUNDS: ReadonlyArray<PencilSound> = ['pencil', 'musical'];
let pencilSound: PencilSound = 'pencil';

export function setPencilSound(sound: PencilSound) {
  pencilSound = sound;
}

const panFor = (x: number) =>
  (Math.min(1, Math.max(0, x / (window.innerWidth || 1))) - 0.5) * 0.5;

/** A short pitched blip, falling a little, like a soft button */
function blip(
  frequency: number,
  {
    volume = 0.16,
    duration = 0.09,
    drop = 0.55,
    delay = 0,
    type = 'triangle' as OscillatorType,
  } = {},
) {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(
    frequency * drop,
    start + duration,
  );
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A puff of filtered noise: paper, rubber, a pencil tip landing */
function puff(
  frequency: number,
  { volume = 0.25, duration = 0.06, q = 1.2 } = {},
) {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getGrain(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(master);
  source.start(start, Math.random() * 1.5);
  source.stop(start + duration + 0.02);
}

// -------------------------------------------------------------- particles

const reduceMotion = matches('(prefers-reduced-motion: reduce)');

const INK = '#2b2a33';
const PAPER = '#fbf8f1';
const MAX_PARTICLES = 180;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  color: string;
  outlined: boolean;
};

const particles: Array<Particle> = [];
let overlay: HTMLCanvasElement | null = null;
let overlayCtx: CanvasRenderingContext2D | null = null;
let frame = 0;
let lastFrame = 0;

/**
 * One fixed sheet over the whole page, so specks can fly past the canvas's
 * frame. Positions are in client pixels.
 */
function getOverlay() {
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
    document.body.appendChild(overlay);
    overlayCtx = overlay.getContext('2d');
  }
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  return overlayCtx;
}

function tickParticles(now: number) {
  const ctx = overlayCtx;
  if (!ctx || !overlay) return;
  const dt = Math.min(48, now - (lastFrame || now));
  lastFrame = now;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += 0.0009 * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const left = 1 - p.age / p.life;
    const radius = p.radius * (0.4 + 0.6 * left);
    ctx.globalAlpha = Math.min(1, left * 1.8);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    if (p.outlined) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  if (particles.length > 0) {
    frame = requestAnimationFrame(tickParticles);
  } else {
    frame = 0;
    lastFrame = 0;
  }
}

/**
 * Flick a few specks off the tip. `dx`/`dy` is the way the stroke is going,
 * so they spray off its sides and trail a little behind.
 */
function spawn(
  x: number,
  y: number,
  color: string | null,
  count: number,
  dx = 0,
  dy = 0,
  burst = false,
) {
  if (reduceMotion || count <= 0) return;
  if (!getOverlay()) return;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    let vx: number;
    let vy: number;
    if (burst || (dx === 0 && dy === 0)) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.06 + Math.random() * 0.12;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed - 0.04;
    } else {
      const side = Math.random() < 0.5 ? -1 : 1;
      const sideways = (0.04 + Math.random() * 0.1) * side;
      const back = -(0.02 + Math.random() * 0.05);
      vx = -uy * sideways + ux * back;
      vy = ux * sideways + uy * back - 0.03;
    }
    // The eraser sheds paper-colored crumbs; pencils shed their color with
    // the odd graphite fleck
    const graphite = color !== null && Math.random() < 0.25;
    particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx,
      vy,
      age: 0,
      life: 320 + Math.random() * 380,
      radius: graphite ? 1 + Math.random() : 1.6 + Math.random() * 1.8,
      color: color === null ? PAPER : graphite ? INK : color,
      outlined: !graphite,
    });
  }
  if (!frame) frame = requestAnimationFrame(tickParticles);
}

// ------------------------------------------------------------ the strokes

type StrokeState = {
  x: number;
  y: number;
  t: number;
  color: string | null;
  handheld: boolean;
  travel: number;
  lastBuzz: number;
  speed: number;
  brush: Brush | null;
  /** Distance since the last accent, and how far until the next */
  accentTravel: number;
  accentEvery: number;
  lastAccent: number;
  /** Leftover from the last spawn, so specks come at an even rate */
  spawnDebt: number;
};

let stroke: StrokeState | null = null;

// How far the tip travels, in CSS pixels, between ticks under the finger.
// The iPhone's tick is stronger than a short Android buzz, so space it out.
const BUZZ_EVERY = canVibrate ? 14 : 22;
const BUZZ_GAP_MS = canVibrate ? 35 : 55;

export const strokeFeedback = {
  start(
    x: number,
    y: number,
    t: number,
    color: string | null,
    pointerType: string,
  ) {
    const handheld = pointerType !== 'mouse';
    // Rested since the last stroke? The sound perks back up
    tire *= Math.exp(-Math.max(0, t - lastActive) / REST_MS);
    lastActive = t;
    stroke = {
      x,
      y,
      t,
      color,
      handheld,
      travel: 0,
      lastBuzz: t,
      speed: 0,
      brush: startBrush(color === null),
      accentTravel: 0,
      // The first one comes a little sooner, so a stroke answers quickly
      accentEvery: 40 + Math.random() * 90,
      lastAccent: -Infinity,
      spawnDebt: 0,
    };
    if (handheld) buzz(8);
  },

  move(x: number, y: number, t: number) {
    const s = stroke;
    if (!s) return;
    const dx = x - s.x;
    const dy = y - s.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const dt = Math.max(1, t - s.t);
    // Smooth it, so one jumpy event doesn't spike the sound
    s.speed = s.speed * 0.6 + (distance / dt) * 0.4;
    s.x = x;
    s.y = y;
    s.t = t;
    tire = Math.min(1, tire + dt / TIRE_AFTER_MS);
    lastActive = t;

    if (!s.brush) s.brush = startBrush(s.color === null);
    if (s.brush) setBrush(s.brush, s.speed);

    // Every hundred-odd pixels the tip digs in a little, less often the longer
    // you keep at it. The eraser stays quiet: it's just paper and rubber.
    s.accentTravel += distance;
    if (
      s.color !== null &&
      // A new stroke's first accent tires less, so every stroke still answers
      s.accentTravel >=
        s.accentEvery * (1 + (s.lastAccent < 0 ? 0.5 : 1.6) * tire) &&
      t - s.lastAccent >= 150
    ) {
      s.accentTravel = 0;
      s.lastAccent = t;
      s.accentEvery = 100 + Math.random() * 120;
      if (pencilSound === 'musical') {
        strokeNote(x, y, s.color, 0.06 * (1 - 0.55 * tire));
      } else {
        // Faster strokes dig in a little harder
        const push = 0.6 + 0.4 * Math.min(1, s.speed / 1.5);
        scritch(0.6 * push * (1 - 0.55 * tire), {
          pan: panFor(x),
          tone: toneFor(s.color),
        });
      }
    }

    s.travel += distance;
    const spacing = BUZZ_SPACING[vibrateLevel()];
    if (
      s.handheld &&
      spacing > 0 &&
      s.travel >= BUZZ_EVERY * spacing &&
      t - s.lastBuzz >= BUZZ_GAP_MS * spacing
    ) {
      s.travel = 0;
      s.lastBuzz = t;
      buzz(5);
    }

    // About one speck every 9px, a few more when moving fast
    s.spawnDebt += distance / 9;
    const count = Math.min(5, Math.floor(s.spawnDebt));
    s.spawnDebt -= count;
    spawn(x, y, s.color, count, dx, dy);
  },

  /** The finger lifted: `dot` when it was a tap rather than a line */
  end(kind: 'dot' | 'line' | 'cancel') {
    const s = stroke;
    stroke = null;
    if (s?.brush) stopBrush(s.brush);
    if (kind === 'dot' && s) {
      if (s.handheld) buzz(12);
      if (pencilSound === 'musical' && s.color !== null) {
        strokeNote(s.x, s.y, s.color, 0.07 * (1 - 0.4 * tire), 0.7);
      } else {
        tap(0.3 * (1 - 0.4 * tire), panFor(s.x));
      }
      spawn(s.x, s.y, s.color, 7, 0, 0, true);
    }
  },
};

// Pentatonic, so any run of colors sounds pleasant
const COLOR_NOTES = [660, 742, 880, 990, 1110, 1320];

export const toolFeedback = {
  color(index: number) {
    buzz(10);
    blip(COLOR_NOTES[index % COLOR_NOTES.length]);
  },
  eraser() {
    buzz(10);
    puff(1100, { volume: 0.35, duration: 0.09, q: 0.8 });
    blip(420, { volume: 0.08, duration: 0.07, drop: 0.7 });
  },
  undo() {
    buzz(8);
    blip(880, { volume: 0.12, duration: 0.06, drop: 0.8 });
    blip(660, { volume: 0.12, duration: 0.08, drop: 0.7, delay: 0.055 });
  },
};

/** A taste of a level just picked in the settings, or of a pencil sound */
export function previewFeedback(
  kind: 'sound' | 'vibrate',
  sound: PencilSound = pencilSound,
) {
  if (kind === 'vibrate') {
    buzz(12);
    return;
  }
  if (sound === 'musical') {
    note(BASE_HZ * 2 ** (7 / 12), { volume: 0.07 });
    note(BASE_HZ * 2 ** (12 / 12), { volume: 0.05 });
    return;
  }
  tap(0.3);
  scritch(0.6);
}

// ------------------------------------------------------------- UI buttons

/**
 * A soft, dry click for pressing a button anywhere in the app: a tiny tick of
 * filtered noise on top of a low, short knock, like a good switch under the
 * thumb. Quieter than the canvas sounds, and a touch different each time so
 * a run of taps doesn't sound canned.
 */
export function uiClick() {
  if (soundLevel() === 0) return;
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  const wobble = 1 + (Math.random() - 0.5) * 0.08;

  const tick = ctx.createBufferSource();
  tick.buffer = getGrain(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3000 * wobble;
  band.Q.value = 1.4;
  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(0.0001, start);
  tickGain.gain.exponentialRampToValueAtTime(0.12, start + 0.001);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.014);
  tick.connect(band).connect(tickGain).connect(master);
  tick.start(start, Math.random() * 1.5);
  tick.stop(start + 0.03);

  const knock = ctx.createOscillator();
  knock.type = 'sine';
  knock.frequency.setValueAtTime(320 * wobble, start);
  knock.frequency.exponentialRampToValueAtTime(170 * wobble, start + 0.03);
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(0.0001, start);
  knockGain.gain.exponentialRampToValueAtTime(0.09, start + 0.002);
  knockGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
  knock.connect(knockGain).connect(master);
  knock.start(start);
  knock.stop(start + 0.05);
}
