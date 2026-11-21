/**
 * The feel of drawing: a light buzz under the finger, a pencil-on-paper
 * scratch that follows how fast you move, specks flicking off the tip, and
 * little clicks for the toolbar. All of it is best effort: whatever the
 * browser can't do is skipped quietly.
 */

// ---------------------------------------------------------------- haptics

const hasWindow = typeof window !== 'undefined';
// Test environments and older browsers may not have matchMedia
const matches = (query: string) =>
  hasWindow &&
  (window as { matchMedia?: typeof window.matchMedia }).matchMedia?.(query)
    .matches === true;
// Not every browser has vibrate (iOS Safari doesn't), whatever the types say
const canVibrate = hasWindow && 'vibrate' in navigator;
const isCoarse = matches('(pointer: coarse)');

let iosSwitch: HTMLLabelElement | null = null;

/**
 * iOS Safari has no vibrate, but since iOS 18 toggling a switch checkbox
 * plays the system's selection tick, so keep a hidden one to flick
 */
function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    // Its clicks are ours; keep them from reaching the app's own handlers
    label.addEventListener('click', (event) => event.stopPropagation());
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

/** A tap of feedback, for devices held in the hand */
function buzz(ms: number) {
  if (!hasWindow) return;
  if (canVibrate) {
    try {
      navigator.vibrate(ms);
    } catch {
      // Blocked (no user gesture yet, or turned off): fine
    }
  } else if (isCoarse) {
    iosTick();
  }
}

// ------------------------------------------------------------------ sound

let audio: AudioContext | null = null;
let master: GainNode | null = null;
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
    master.gain.value = 0.6;
    master.connect(audio.destination);
  }
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

/** Graphite on paper: soft hiss with a sprinkle of tiny catches in the grain */
function getGrain(ctx: AudioContext) {
  if (grainBuffer && grainBuffer.sampleRate === ctx.sampleRate)
    return grainBuffer;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let catchLeft = 0;
  let catchLevel = 0;
  for (let i = 0; i < length; i++) {
    if (catchLeft <= 0 && Math.random() < 0.0015) {
      catchLeft = Math.floor(ctx.sampleRate * (0.002 + Math.random() * 0.006));
      catchLevel = 0.5 + Math.random() * 0.6;
    }
    const level = catchLeft-- > 0 ? catchLevel : 0.28;
    data[i] = (Math.random() * 2 - 1) * level;
  }
  grainBuffer = buffer;
  return buffer;
}

type Scratch = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};

function startScratch(): Scratch | null {
  const ctx = getAudio();
  if (!ctx || !master || ctx.state !== 'running') return null;
  const source = ctx.createBufferSource();
  source.buffer = getGrain(ctx);
  source.loop = true;
  // Start somewhere new in the loop so strokes don't all sound alike
  const offset = Math.random() * source.buffer.duration;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 900;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(highpass).connect(filter).connect(gain).connect(master);
  source.start(ctx.currentTime, offset);
  return { source, filter, gain };
}

function setScratch(scratch: Scratch, speed: number) {
  const ctx = scratch.source.context;
  // Speed is in CSS pixels per millisecond; a brisk stroke is around 1.5
  const amount = Math.min(1, speed / 1.5);
  const now = ctx.currentTime;
  scratch.gain.gain.setTargetAtTime(amount * 0.22, now, 0.03);
  scratch.filter.frequency.setTargetAtTime(1800 + amount * 2600, now, 0.05);
}

function stopScratch(scratch: Scratch) {
  const ctx = scratch.source.context;
  const now = ctx.currentTime;
  scratch.gain.gain.cancelScheduledValues(now);
  scratch.gain.gain.setTargetAtTime(0, now, 0.025);
  scratch.source.stop(now + 0.2);
}

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
  scratch: Scratch | null;
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
    stroke = {
      x,
      y,
      t,
      color,
      handheld,
      travel: 0,
      lastBuzz: t,
      speed: 0,
      scratch: startScratch(),
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

    if (!s.scratch) s.scratch = startScratch();
    if (s.scratch) setScratch(s.scratch, s.speed);

    s.travel += distance;
    if (s.handheld && s.travel >= BUZZ_EVERY && t - s.lastBuzz >= BUZZ_GAP_MS) {
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
    if (s?.scratch) stopScratch(s.scratch);
    if (kind === 'dot' && s) {
      if (s.handheld) buzz(12);
      puff(3200, { volume: 0.3, duration: 0.045, q: 2 });
      blip(1500, { volume: 0.05, duration: 0.05, drop: 0.7, type: 'sine' });
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
