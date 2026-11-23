import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Sfx from '../sfx';
import type * as Voices from '../voices';

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
  playbackRate = new FakeParam();
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
  decodeAudioData() {
    return Promise.resolve({ duration: 0.3 });
  }
  createBuffer(channels: number, length: number) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return {
      sampleRate: this.sampleRate,
      getChannelData: (c: number) => data[c],
    };
  }
}

let sfx: typeof Sfx;
let voices: typeof Voices;

beforeAll(async () => {
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  sfx = await import('../sfx');
  voices = await import('../voices');
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
    expect(voices.voiceFor('Pablo')).toEqual(voices.voiceFor('Pablo'));
    const made = new Set(
      ['Pablo', 'Frida', 'Vincent', 'Georgia', 'Claude'].map((name) =>
        JSON.stringify(voices.voiceFor(name)),
      ),
    );
    expect(made.size).toBe(5);
  });

  it('gives the judges we know their own silly instruments', () => {
    const critic = voices.voiceFor('Sir Doodleton');
    const pickle = voices.voiceFor('Professor Pickles');
    const santa = voices.voiceFor('Santa');
    expect(new Set([critic.sound, pickle.sound, santa.sound]).size).toBe(3);
    // Santa's deepest, the pickle highest and most excitable
    expect(santa.root).toBeLessThan(critic.root);
    expect(pickle.root).toBeGreaterThan(critic.root);
    expect(pickle.range).toBeGreaterThan(critic.range);
  });

  it('gives the Grinch a low, sinister grumble with a growl', () => {
    const grinch = voices.voiceFor('The Grinch');
    const santa = voices.voiceFor('Santa');
    expect(grinch.sound).toBe('grumble');
    expect(grinch.mode).toBe('sinister');
    expect(grinch.snarl).toBe(true);
    // Deeper than even Santa, and sinking at the end of every sentence
    expect(grinch.root).toBeLessThan(santa.root);
    expect(grinch.droop).toBeGreaterThan(santa.droop);
  });

  it('babbles every syllable of a line in every voice', () => {
    const line = 'Hmm. Magnifique, darling? Ho ho, splendid pickles!';
    for (const name of [
      'Sir Doodleton',
      'Professor Pickles',
      'Santa',
      'The Grinch',
      'Zed',
    ]) {
      const voice = voices.voiceFor(name);
      for (const syllable of voices.syllablesOf(line).values()) {
        for (const ending of ['.', '?', '!'] as const) {
          const before = counts.oscillators + counts.sources;
          expect(
            voices.speak(voice, {
              ...syllable,
              seconds: 0.1,
              progress: 0.9,
              ending,
            }),
          ).not.toBeNull();
          expect(counts.oscillators + counts.sources).toBeGreaterThan(before);
        }
      }
    }
  });

  it('finds one syllable per vowel sound, starting on its consonants', () => {
    const plan = (text: string) =>
      [...voices.syllablesOf(text)].map(([at, s]) =>
        text.slice(at, at + s.letters),
      );
    expect(plan('doodle')).toEqual(['doo', 'dle']);
    expect(plan('make')).toEqual(['make']);
    expect(plan('hmm')).toEqual(['hmm']);
    expect(plan('splendid')).toEqual(['splen', 'did']);
    // The last syllable before a comma or stop rings out
    const [first, last] = [...voices.syllablesOf('ho ho!').values()];
    expect(first.trailing).toBe(false);
    expect(last.trailing).toBe(true);
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
