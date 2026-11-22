// Word-list profanity filter: no AI, no network. Finds swear words and slurs in user text so the UI
// can cover them with a redacted box. Matching is per word, so "class" and "Scunthorpe" stay clean.

// Whole words only. Mild words (hell, damn, crap) are left out on purpose.
const WORDS = new Set([
  'arse',
  'arsehole',
  'ass',
  'asses',
  'asshat',
  'asswipe',
  'badass',
  'bastard',
  'bastards',
  'bellend',
  'blowjob',
  'bollocks',
  'boner',
  'boob',
  'boobs',
  'booty',
  'buttplug',
  'bullshit',
  'chink',
  'clit',
  'cock',
  'cocks',
  'cocksucker',
  'coon',
  'cum',
  'cumming',
  'cumshot',
  'cunt',
  'cunts',
  'dick',
  'dickhead',
  'dicks',
  'dildo',
  'douche',
  'douchebag',
  'dumbass',
  'dyke',
  'fag',
  'fags',
  'faggot',
  'faggots',
  'fck',
  'fcking',
  'fuk',
  'fuking',
  'gook',
  'handjob',
  'hoe',
  'hoes',
  'horny',
  'jackass',
  'jerkoff',
  'kike',
  'kys',
  'milf',
  'nazi',
  'negro',
  'nigga',
  'niggas',
  'nigger',
  'niggers',
  'nude',
  'nudes',
  'orgasm',
  'paki',
  'penis',
  'piss',
  'pissed',
  'porn',
  'porno',
  'prick',
  'pussies',
  'pussy',
  'rape',
  'raped',
  'rapist',
  'retard',
  'retarded',
  'retards',
  'schlong',
  'scrotum',
  'semen',
  'sex',
  'sexy',
  'shemale',
  'skank',
  'smartass',
  'spic',
  'stfu',
  'testicle',
  'tit',
  'tits',
  'titties',
  'titty',
  'tranny',
  'twat',
  'vagina',
  'wetback',
  'wtf',
]);

// Roots that are profane anywhere inside a word: "motherfucker", "shitty", "bitchy".
const STEMS = [
  'fuck',
  'shit',
  'bitch',
  'whore',
  'slut',
  'asshole',
  'wank',
  'jizz',
  'cunt',
];

// Clean words that happen to contain a stem.
const ALLOW = new Set(['scunthorpe', 'shitake', 'shiitake', 'swank', 'swanky']);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

const normalize = (word: string) =>
  word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[013457@$!]/g, (c) => LEET[c]);

// "fuuuuck" -> "fuuck" and "fuck"; "assss" -> "ass" and "as"
const squeeze = (word: string) => [
  word,
  word.replace(/(.)\1{2,}/g, '$1$1'),
  word.replace(/(.)\1+/g, '$1'),
];

// "f*ck", "sh*t": try each vowel in place of the stars
const unmask = (word: string) =>
  word.includes('*')
    ? ['a', 'e', 'i', 'o', 'u'].map((v) => word.replace(/\*+/g, v))
    : [word];

export function isProfane(word: string): boolean {
  const base = normalize(word);
  if (ALLOW.has(base)) return false;
  return unmask(base).some((w) =>
    squeeze(w).some(
      (c) => WORDS.has(c) || STEMS.some((stem) => c.includes(stem)),
    ),
  );
}

export type Segment = { text: string; profane: boolean };

// Letters, digits and leet symbols; ! and * only count inside a word so "fuck!" ends at the k.
const WORD = /[\p{L}\p{N}@$]+(?:[!*]+[\p{L}\p{N}@$]+)*/gu;

/** Splits text into runs, flagging each profane word so it can be drawn redacted. */
export function findProfanity(text: string): Array<Segment> {
  const segments: Array<Segment> = [];
  let last = 0;
  for (const match of text.matchAll(WORD)) {
    if (!isProfane(match[0])) continue;
    const start = match.index;
    if (start > last)
      segments.push({ text: text.slice(last, start), profane: false });
    segments.push({ text: match[0], profane: true });
    last = start + match[0].length;
  }
  if (last < text.length)
    segments.push({ text: text.slice(last), profane: false });
  return segments;
}
