/**
 * A tiny synth for the app's celebrations. Every sound is built on the fly
 * from oscillators and noise (no files to download), played through one
 * shared chain: a glue compressor so big explosions stay punchy without
 * clipping, and a short room reverb that sparkles and chords can send to.
 *
 * Sounds are grouped into cues. A cue has its own volume, starts at a moment
 * on the audio clock and can be stopped as a whole, so an animation that's
 * skipped or tapped away fades its sounds out with it.
 *
 * All of it is best effort: no Web Audio, sound turned off in settings, a
 * hidden tab or audio not yet unlocked by a tap and it quietly does nothing.
 */

import { getFeedbackSettings } from '@/drawing/feedbackSettings';

const hasWindow = typeof window !== 'undefined';

// Times the master volume for each sound setting, the canvas's scale
const LEVEL_VOLUME = [0, 0.3, 0.6, 1, 1.5];
const MASTER = 0.55;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function build(): AudioContext | null {
  if (!hasWindow) return null;
  if (ctx) return ctx;
  const loose = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = loose.AudioContext ?? loose.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -14;
  glue.knee.value = 10;
  glue.ratio.value = 5;
  glue.attack.value = 0.003;
  glue.release.value = 0.18;
  glue.connect(ctx.destination);

  master = ctx.createGain();
  master.connect(glue);

  // A small bright room: decaying noise, a touch longer on the right
  reverb = ctx.createConvolver();
  const seconds = 1.6;
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** (channel ? 2.6 : 2.9);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  reverb.connect(wet).connect(master);
  return ctx;
}

/** The running context, or null when sound can't or shouldn't play now */
function live(): AudioContext | null {
  const level = getFeedbackSettings().sound;
  if (level === 0) return null;
  if (hasWindow && document.visibilityState === 'hidden') return null;
  const audio = build();
  if (!audio || !master) return null;
  master.gain.value = MASTER * LEVEL_VOLUME[level];
  if (audio.state === 'suspended') void audio.resume().catch(() => {});
  // Anything queued while suspended would all go off at once on resume
  return audio.state === 'running' ? audio : null;
}

// Celebrations usually follow a tap, but wake the audio on the first few
// touches anyway so one that starts on its own (say, on page load) can sing
if (hasWindow) {
  const events = ['pointerup', 'touchend', 'click', 'keydown'];
  const unlock = () => {
    if (getFeedbackSettings().sound === 0) return;
    const audio = build();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    if (audio.state === 'running') {
      events.forEach((type) => window.removeEventListener(type, unlock, true));
    }
  };
  events.forEach((type) => window.addEventListener(type, unlock, true));
}

function noise(audio: AudioContext) {
  if (noiseBuffer?.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = audio.sampleRate * 2;
  noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** MIDI note number to Hz (60 is middle C) */
export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Envelope = {
  /** Seconds after the cue's start */
  at?: number;
  /** Peak volume, about 0–1 */
  volume?: number;
  attack?: number;
  /** How long it takes to die away after the attack */
  decay?: number;
  /** Hold at the peak this long before decaying */
  hold?: number;
  /** -1 left to 1 right */
  pan?: number;
  /** How much goes to the reverb, 0–1 */
  wet?: number;
};

export type ToneOptions = Envelope & {
  type?: OscillatorType;
  /** Glide to this frequency over the sound */
  glideTo?: number;
  /** How long the glide takes (defaults to the whole sound) */
  glideTime?: number;
  /** Cents, for a second voice beside the first */
  detune?: number;
  /** A lowpass that opens from `from` to `to` Hz */
  filter?: { from: number; to: number; time?: number; q?: number };
  /** Wobble, in cents and Hz */
  vibrato?: { depth: number; rate: number };
};

export type NoiseOptions = Envelope & {
  filter?: BiquadFilterType;
  /** Filter frequency, swept to `sweepTo` over the sound */
  frequency?: number;
  sweepTo?: number;
  q?: number;
};

/**
 * A group of sounds that start together and stop together. Its times are in
 * seconds from when it was made.
 */
export class Cue {
  readonly audio: AudioContext;
  readonly t0: number;
  private readonly bus: GainNode;
  private readonly send: GainNode;
  private stopped = false;

  constructor(audio: AudioContext, volume: number, delay = 0) {
    this.audio = audio;
    this.t0 = audio.currentTime + 0.01 + delay;
    this.bus = audio.createGain();
    this.bus.gain.value = volume;
    this.bus.connect(master!);
    this.send = audio.createGain();
    this.send.gain.value = volume;
    this.send.connect(reverb!);
  }

  /** Fade everything in this cue out */
  stop(fade = 0.12) {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.audio.currentTime;
    for (const node of [this.bus, this.send]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.setTargetAtTime(0, now, fade / 3);
    }
    window.setTimeout(
      () => {
        this.bus.disconnect();
        this.send.disconnect();
      },
      fade * 1000 + 400,
    );
  }

  get isStopped() {
    return this.stopped;
  }

  /** Seconds since the cue started, on the audio clock */
  get elapsed() {
    return this.audio.currentTime - this.t0;
  }

  /** Connects a voice through its envelope, pan and reverb send */
  private out(node: AudioNode, env: Envelope, length: number) {
    const audio = this.audio;
    const start = this.t0 + (env.at ?? 0);
    const volume = env.volume ?? 0.3;
    const attack = env.attack ?? 0.005;
    const hold = env.hold ?? 0;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    if (hold) gain.gain.setValueAtTime(volume, start + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    node.connect(gain);
    let tail: AudioNode = gain;
    if (env.pan && 'createStereoPanner' in audio) {
      const panner = audio.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, env.pan));
      tail = gain.connect(panner);
    }
    tail.connect(this.bus);
    if (env.wet) {
      const wet = audio.createGain();
      wet.gain.value = env.wet;
      tail.connect(wet).connect(this.send);
    }
    return { start, end: start + length };
  }

  /** One pitched voice */
  tone(frequency: number, options: ToneOptions = {}) {
    if (this.stopped) return;
    const audio = this.audio;
    const length =
      (options.attack ?? 0.005) + (options.hold ?? 0) + (options.decay ?? 0.2);
    const voices = options.detune ? [-options.detune, options.detune] : [0];
    let input: AudioNode;
    let filter: BiquadFilterNode | null = null;
    if (options.filter) {
      filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = options.filter.q ?? 1;
      input = filter;
    } else {
      input = audio.createGain();
    }
    const { start, end } = this.out(input, options, length);
    if (filter && options.filter) {
      filter.frequency.setValueAtTime(options.filter.from, start);
      filter.frequency.exponentialRampToValueAtTime(
        options.filter.to,
        start + (options.filter.time ?? length * 0.5),
      );
    }
    for (const cents of voices) {
      const osc = audio.createOscillator();
      osc.type = options.type ?? 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      osc.detune.value = cents;
      if (options.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(
          options.glideTo,
          start + (options.glideTime ?? length),
        );
      }
      if (options.vibrato) {
        const lfo = audio.createOscillator();
        lfo.frequency.value = options.vibrato.rate;
        const depth = audio.createGain();
        depth.gain.value = options.vibrato.depth;
        lfo.connect(depth).connect(osc.detune);
        lfo.start(start);
        lfo.stop(end + 0.05);
      }
      osc.connect(input);
      osc.start(start);
      osc.stop(end + 0.05);
    }
  }

  /** Filtered noise: whooshes, paper, crackle, snare */
  noise(options: NoiseOptions = {}) {
    if (this.stopped) return;
    const audio = this.audio;
    const length =
      (options.attack ?? 0.005) + (options.hold ?? 0) + (options.decay ?? 0.15);
    const source = audio.createBufferSource();
    source.buffer = noise(audio);
    const filter = audio.createBiquadFilter();
    filter.type = options.filter ?? 'bandpass';
    filter.Q.value = options.q ?? 1;
    source.connect(filter);
    const { start, end } = this.out(filter, options, length);
    filter.frequency.setValueAtTime(options.frequency ?? 2000, start);
    if (options.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(options.sweepTo, end);
    }
    source.start(start, Math.random() * 1.5);
    source.stop(end + 0.05);
  }
}

/** A new cue, or null when nothing should sound */
export function startCue(volume = 1, delay = 0): Cue | null {
  const audio = live();
  if (!audio) return null;
  try {
    return new Cue(audio, volume, delay);
  } catch {
    return null;
  }
}

/** Plays a one-shot sound now; drawing errors are swallowed */
export function play(
  draw: (cue: Cue) => void,
  volume = 1,
  delay = 0,
): Cue | null {
  const c = startCue(volume, delay);
  if (!c) return null;
  try {
    draw(c);
  } catch {
    // An unsupported node in an old browser: skip it
  }
  return c;
}
