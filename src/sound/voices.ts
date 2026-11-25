/**
 * The AI judges' talking voices: silly cartoon babble, one little "bop" for
 * each syllable of their line as it types out. Every syllable lands on a note
 * of a cheerful scale (a sour one for the Grinch), so it bounces along like a
 * tune instead of beeping at random. Each judge we know has their own funny instrument; anyone new gets
 * one picked from their name, in a key of their own.
 */

import { hz, play } from './engine';
import type { Cue } from './engine';

/**
 * How a syllable sounds:
 * - bop: a round little pop that drops in pitch
 * - boing: a squeaky "bwip!" that springs upward, with a bubbly wobble
 * - kazoo: a buzzy, snooty honk that droops at the end
 * - bwomp: a big bouncy tuba-ish "bwomp"
 * - grumble: a low, growly, sour mutter that sinks as it goes
 */
type Sound = 'bop' | 'boing' | 'kazoo' | 'bwomp' | 'grumble';

export type Voice = {
  sound: Sound;
  /** The MIDI note of their home key (60 is middle C) */
  root: number;
  /** How many scale notes their pitch hops over: small is measured, big is excitable */
  range: number;
  /** Scale notes the pitch sinks by the end of a sentence */
  droop: number;
  /** Sleigh bells when they're excited */
  jingle?: boolean;
  /** A throaty growl when they're worked up */
  snarl?: boolean;
  /** The notes they babble on: sunny (the default), or sour and sinister */
  mode?: 'sunny' | 'sinister';
  /** 1 is the usual level */
  volume: number;
  /** Typing pace: over 1 is slower, more deliberate */
  pace: number;
};

/**
 * Voices for the judges we know, matched loosely by name so a small rename
 * doesn't lose them
 */
const PERSONAS: Array<{ match: RegExp; voice: Voice }> = [
  {
    // Sir Doodleton: a snooty kazoo. Measured, and drooping "hmph" at the
    // end of every sentence
    match: /doodleton/i,
    voice: {
      sound: 'kazoo',
      root: 57,
      range: 3,
      droop: 3,
      volume: 1,
      pace: 1.3,
    },
  },
  {
    // Professor Pickles: a giddy, squeaky "bwip! boing!", bubbling and
    // bouncing all over the scale
    match: /pickle/i,
    voice: {
      sound: 'boing',
      root: 74,
      range: 7,
      droop: 0,
      volume: 1,
      pace: 0.85,
    },
  },
  {
    // Santa: a big jolly "bwomp bwomp", with sleigh bells when he's excited
    match: /santa|claus/i,
    voice: {
      sound: 'bwomp',
      root: 50,
      range: 4,
      droop: 1,
      jingle: true,
      volume: 1,
      pace: 1.15,
    },
  },
  {
    // The Union Elves: a quick, high little "bop" with bells on their hats,
    // sagging at the end of every sentence because they're so tired
    match: /elves|union/i,
    voice: {
      sound: 'bop',
      root: 76,
      range: 5,
      droop: 2,
      jingle: true,
      volume: 1,
      pace: 0.9,
    },
  },
  {
    // The Grinch: a low, sour grumble on villain's notes, sinking at the end
    // of every sentence, with a growl when he's worked up. Slow and sneering.
    match: /grinch/i,
    voice: {
      sound: 'grumble',
      root: 45,
      range: 3,
      droop: 3,
      snarl: true,
      mode: 'sinister',
      volume: 1,
      pace: 1.25,
    },
  },
];

const hashOf = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/** A judge's voice: set by hand for the ones we know, made from the name otherwise */
export function voiceFor(name: string): Voice {
  const known = PERSONAS.find((persona) => persona.match.test(name));
  if (known) return known.voice;
  const hash = hashOf(name);
  return {
    sound: (['bop', 'bop', 'boing', 'bwomp'] as const)[(hash >> 8) % 4],
    root: 60 + (hash % 12),
    range: 3 + ((hash >> 4) % 4),
    droop: 1,
    volume: 1,
    pace: 1,
  };
}

/** One syllable of a line, found ahead of time from its text */
export type PlannedSyllable = {
  /** Letters it spans, so a long one is held longer */
  letters: number;
  /** The last of its word before punctuation, which gets drawn out */
  trailing: boolean;
  /** Its place in the line, for steady variety */
  index: number;
};

const isVowel = (letter: string) => /^[aeiouy]/i.test(letter.normalize('NFD'));

/**
 * Where each syllable of `text` starts (by letter index): one per group of
 * vowels in a word, starting at the consonants in front of it. Words with no
 * vowel at all ("hmm") are one syllable.
 */
export function syllablesOf(text: string) {
  const plan = new Map<number, PlannedSyllable>();
  let index = 0;
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const word = match[0];
    const at = match.index;
    const starts: Array<number> = [];
    // Just past the last vowel group, where the next syllable can start
    let begin = 0;
    for (let i = 0; i < word.length; i++) {
      const vowel = isVowel(word[i]) && !(word[i] === 'y' && i === 0);
      if (vowel && (i === 0 || !isVowel(word[i - 1]))) {
        // A silent e on the end doesn't get a syllable of its own, but the
        // e of "doodle" or "able" does
        const final = i === word.length - 1 && /e/i.test(word[i]);
        const le = final && /[^aeiouy]l$/i.test(word.slice(0, i));
        if (!final || le || starts.length === 0) {
          // Later syllables start on the one consonant before their vowel
          // ("splen-did"), or two for "-dle"
          const lead = le ? 2 : 1;
          starts.push(starts.length ? Math.max(begin, i - lead) : 0);
        }
      }
      if (vowel && (i === word.length - 1 || !isVowel(word[i + 1]))) {
        begin = i + 1;
      }
    }
    if (starts.length === 0) starts.push(0);
    const after = text.slice(at + word.length, at + word.length + 2);
    starts.forEach((start, n) => {
      const next = starts[n + 1] ?? word.length;
      plan.set(at + start, {
        letters: next - start,
        trailing: n === starts.length - 1 && /^\s*[.,!?;:…]/.test(after),
        index: index++,
      });
    });
  }
  return plan;
}

/** A syllable, as the typewriter reaches it */
export type Syllable = PlannedSyllable & {
  /** Seconds until the next one, about */
  seconds: number;
  /** 0–1 through the sentence it's in */
  progress: number;
  /** How the sentence ends */
  ending: '.' | '?' | '!';
};

// Major pentatonic: any run of these notes sounds sunny
const PENTA = [0, 2, 4, 7, 9];
// Minor with a flat second and a tritone: the classic villain's notes
const SINISTER = [0, 1, 3, 6, 7];
const scale = (root: number, step: number, notes = PENTA) => {
  const octave = Math.floor(step / notes.length);
  return root + octave * 12 + notes[((step % 5) + 5) % 5];
};

type Say = { note: number; length: number; volume: number };

/** Each sound's little instrument */
const SOUNDS: Record<Sound, (c: Cue, say: Say) => void> = {
  bop: (c, { note, length, volume }) => {
    c.tone(hz(note + 3), {
      type: 'triangle',
      glideTo: hz(note),
      glideTime: 0.04,
      attack: 0.004,
      decay: length,
      volume,
    });
  },
  boing: (c, { note, length, volume }) => {
    // "Bwip!": springs up from below, wobbling like a bubble
    c.tone(hz(note - 5), {
      type: 'sine',
      glideTo: hz(note + 2),
      glideTime: 0.05,
      attack: 0.004,
      decay: length,
      vibrato: { depth: 45, rate: 16 },
      volume,
    });
    // A tiny sparkle an octave up gives it its squeak
    c.tone(hz(note + 12), {
      type: 'triangle',
      attack: 0.004,
      decay: 0.04,
      volume: volume * 0.25,
    });
  },
  kazoo: (c, { note, length, volume }) => {
    // Buzzy and nasal, sagging a little as it goes
    c.tone(hz(note), {
      type: 'sawtooth',
      glideTo: hz(note - 1.5),
      attack: 0.015,
      hold: length * 0.4,
      decay: length * 0.6,
      vibrato: { depth: 30, rate: 7 },
      filter: { from: 2200, to: 900, q: 6 },
      volume: volume * 0.5,
    });
  },
  grumble: (c, { note, length, volume }) => {
    // Two rough, slightly out-of-tune buzzes sagging a semitone, muffled like
    // a mutter under his breath
    for (const detune of [-14, 14]) {
      c.tone(hz(note), {
        type: 'sawtooth',
        glideTo: hz(note - 1),
        detune,
        attack: 0.02,
        hold: length * 0.35,
        decay: length * 0.75,
        vibrato: { depth: 25, rate: 5 },
        filter: { from: 1300, to: 420, q: 8 },
        volume: volume * 0.45,
      });
    }
    // A rumble in his chest, an octave down
    c.tone(hz(note - 12), {
      type: 'sine',
      glideTo: hz(note - 13),
      attack: 0.01,
      decay: length,
      volume: volume * 0.7,
    });
  },
  bwomp: (c, { note, length, volume }) => {
    // A round "bwomp" that bounces down, and a thump in its belly
    c.tone(hz(note + 4), {
      type: 'triangle',
      glideTo: hz(note - 2),
      glideTime: 0.07,
      attack: 0.01,
      hold: length * 0.3,
      decay: length * 0.7,
      vibrato: { depth: 15, rate: 6 },
      volume,
    });
    c.tone(hz(note - 12), {
      type: 'sine',
      glideTo: hz(note - 15),
      attack: 0.008,
      decay: length * 0.8,
      volume: volume * 0.6,
    });
  },
};

/** Evens the instruments out, so each sits with the app's other sounds */
const LEVEL: Record<Sound, number> = {
  bop: 0.18,
  boing: 0.18,
  kazoo: 0.2,
  bwomp: 0.1,
  grumble: 0.14,
};

/** Says one syllable of babble in a judge's voice */
export function speak(voice: Voice, syllable: Syllable) {
  const { progress, ending, index } = syllable;

  // Hops around the scale, steady for the same line
  let step =
    Math.round((((index * 37 + syllable.letters * 11) % 9) / 8) * voice.range) -
    Math.round(voice.droop * progress);
  if (ending === '?') step += Math.round(voice.range * progress * progress);
  if (ending === '!') step += 1;
  const note = scale(
    voice.root,
    step,
    voice.mode === 'sinister' ? SINISTER : PENTA,
  );

  // Mid-word bops are quick; the end of a phrase holds on, "boppp"
  const length = syllable.trailing
    ? 0.22
    : Math.min(0.14, Math.max(0.06, syllable.seconds * 0.9));
  const volume =
    voice.volume * LEVEL[voice.sound] * (ending === '!' ? 1.15 : 1);

  return play((c) => {
    SOUNDS[voice.sound](c, { note, length, volume });
    if (voice.snarl && ending === '!' && syllable.trailing) {
      // A growl: a rattling low buzz and a rush of breath that sinks away
      c.tone(hz(voice.root - 12), {
        at: 0.04,
        type: 'sawtooth',
        glideTo: hz(voice.root - 15),
        attack: 0.02,
        decay: 0.3,
        vibrato: { depth: 70, rate: 26 },
        filter: { from: 700, to: 220, q: 4 },
        volume: 0.06,
      });
      c.noise({
        at: 0.04,
        filter: 'lowpass',
        frequency: 1100,
        sweepTo: 240,
        decay: 0.28,
        volume: 0.05,
      });
    }
    if (voice.jingle && ending === '!' && syllable.trailing) {
      // Sleigh bells: a quick shake of bright jingles
      for (let i = 0; i < 4; i++) {
        c.noise({
          at: 0.05 + i * 0.045,
          filter: 'highpass',
          frequency: 7000,
          decay: 0.05,
          volume: 0.05,
        });
        c.tone(hz(scale(84, i * 2)), {
          at: 0.05 + i * 0.045,
          type: 'sine',
          decay: 0.12,
          volume: 0.03,
        });
      }
    }
  });
}
