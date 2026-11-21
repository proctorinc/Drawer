import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Sfx from '../sfx';

/**
 * A stand-in AudioContext that records what's built, so every sound can run
 * its whole graph in jsdom. Throws on the mistakes the real one throws on
 * (an exponential ramp to zero or below, a param at NaN).
 */
const counts = { oscillators: 0, sources: 0 };

class FakeParam {
  value = 0;
  private check(v: number) {
    if (!Number.isFinite(v)) throw new Error(`bad value ${v}`);
  }
  setValueAtTime(v: number, t: number) {
    this.check(v);
    this.check(t);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0)) throw new Error(`exponential ramp to ${v}`);
    this.check(t);
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  pan = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect<T>(target: T) {
    return target;
  }
  disconnect() {}
  start(when = 0) {
    if (!Number.isFinite(when)) throw new Error('bad start');
  }
  stop() {}
}

class FakeContext {
  state = 'running';
  currentTime = 1;
  sampleRate = 8000;
  destination = new FakeNode();
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createConvolver() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createStereoPanner() {
    return new FakeNode();
  }
  createOscillator() {
    counts.oscillators++;
    return new FakeNode();
  }
  createBufferSource() {
    counts.sources++;
    return new FakeNode();
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return { sampleRate: this.sampleRate, getChannelData: (c: number) => data[c] };
  }
}

let sfx: typeof Sfx;

beforeAll(async () => {
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  sfx = await import('../sfx');
});

afterEach(() => {
  counts.oscillators = 0;
  counts.sources = 0;
});

describe('sfx', () => {
  it('builds every one-shot without a hitch', () => {
    const oneShots = [
      sfx.cardIn,
      sfx.cardOut,
      () => sfx.pageFlip(1),
      () => sfx.reactionPop(3, true),
      () => sfx.reactionPop(3, false),
      sfx.xpIn,
      () => sfx.xpTick(0.5),
      sfx.xpLevelUp,
      sfx.xpTierUp,
      sfx.xpLand,
      sfx.xpOut,
      sfx.tickerIn,
      () => sfx.tickerCount(2, 5),
      sfx.tickerComplete,
      () => sfx.completedCard('sticker'),
      () => sfx.completedCard('achievement'),
      () => sfx.completedCard('quest'),
      sfx.rewardReveal,
      sfx.pinLift,
      () => sfx.pinDrop(0.6),
      sfx.pinTack,
      () => sfx.pinSwing(1.9),
      sfx.pinSettled,
      () => sfx.babble(sfx.voiceFor('Judge'), 'a', true),
    ];
    for (const sound of oneShots) {
      const before = counts.oscillators + counts.sources;
      // play() swallows errors, so a broken graph would make nothing at all
      expect(sound()).not.toBeNull();
      expect(counts.oscillators + counts.sources).toBeGreaterThan(before);
    }
  });

  it('plays the rank-up through every beat at both ends of the ladder', () => {
    for (const intensity of [0, 1]) {
      for (const reveal of ['flip', 'crack'] as const) {
        const sound = sfx.rankUpSound({
          intensity,
          pace: 1.2,
          reveal,
          confetti: true,
          sparkles: true,
          sweep: true,
          buildUp: 1.3,
        });
        for (const beat of [
          'wash',
          'old',
          'turn',
          'new',
          'stamp',
          'ready',
        ] as const) {
          expect(() => sound.beat(beat)).not.toThrow();
        }
        expect(() => sound.stop()).not.toThrow();
      }
    }
    // The big tiers make a lot more noise than the small ones
    expect(counts.oscillators).toBeGreaterThan(100);
  });

  it('gives each judge a steady voice of their own', () => {
    expect(sfx.voiceFor('Pablo')).toEqual(sfx.voiceFor('Pablo'));
    const voices = new Set(
      ['Pablo', 'Frida', 'Vincent', 'Georgia', 'Claude'].map((name) =>
        JSON.stringify(sfx.voiceFor(name)),
      ),
    );
    expect(voices.size).toBeGreaterThan(1);
  });

  it('stays quiet when sound is turned off', async () => {
    const { setFeedbackLevel } = await import('@/drawing/feedbackSettings');
    setFeedbackLevel('sound', 0);
    try {
      expect(sfx.rewardReveal()).toBeNull();
      expect(counts.oscillators + counts.sources).toBe(0);
    } finally {
      setFeedbackLevel('sound', 3);
    }
  });

  it('stays quiet in a hidden tab', () => {
    const spy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    try {
      expect(sfx.cardIn()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
