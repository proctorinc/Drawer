/*
 * Picks the sketch face a user gets before they draw their own. Nothing is
 * stored: the parts come from a hash of the user's id, so everyone keeps the
 * same face on every device, and the color comes from userColor like the
 * rest of their things.
 */

export type AvatarLook = 'masc' | 'fem';

export const HAIR = {
  masc: [
    'crop',
    'sidePart',
    'spiky',
    'buzz',
    'quiff',
    'curly',
    'messy',
    'mohawk',
  ],
  fem: [
    'long',
    'bob',
    'ponytail',
    'bun',
    'curlyLong',
    'pigtails',
    'sweep',
    'wavy',
  ],
} as const;

export const NECKLINES = [
  'crew',
  'vNeck',
  'collar',
  'hoodie',
  'turtleneck',
] as const;
export const GLASSES = ['none', 'square', 'round'] as const;
export const EXTRAS = {
  masc: ['none', 'beard', 'mustache'],
  fem: ['none', 'earrings'],
} as const;

export type Hair = (typeof HAIR)[AvatarLook][number];
export type Neckline = (typeof NECKLINES)[number];
export type Glasses = (typeof GLASSES)[number];
export type Extra = (typeof EXTRAS)[AvatarLook][number];

export type AvatarParts = {
  look: AvatarLook;
  hair: Hair;
  neckline: Neckline;
  glasses: Glasses;
  extra: Extra;
  /** A small tilt, in degrees, so a row of faces doesn't look stamped */
  tilt: number;
};

/** How many different faces there are, before color */
export const FACE_COUNT = (['masc', 'fem'] as const).reduce(
  (sum, look) =>
    sum +
    HAIR[look].length * NECKLINES.length * GLASSES.length * EXTRAS[look].length,
  0,
);

/** A 32-bit FNV-1a hash */
const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** mulberry32: each part gets its own draw, so parts don't move together */
const randomFrom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(list: ReadonlyArray<T>, random: () => number): T =>
  list[Math.floor(random() * list.length)];

/** A set from a space-separated list, so long lists stay compact */
const wordSet = (list: string) => new Set(list.trim().split(/\s+/));

// Words that say who someone is, matched as whole words
const FEM_WORDS = wordSet(`
  mom mommy mama mum mummy mother grandma granny nana gma aunt auntie sister
  sis wife wifey girl gal lady queen princess miss mrs ms daughter her she
  woman madam
  mary jen jenny jennifer jess jessica sarah sara emily emma olivia ava sophia
  mia amelia ella grace chloe lily hannah anna ann anne kate katie kat liz beth
  elizabeth amy amanda ashley megan lauren rachel rebecca becky nicole
  stephanie linda susan karen lisa nancy michelle laura julia julie claire abby
  abigail zoe nora lucy ellie molly natalie victoria madison brooke kayla
  heather tiffany melissa erin kelly christina maria sophie isabella charlotte
  harper evelyn ruby rose jane amber brittany courtney danielle samantha alexis
  haley hailey jasmine mckenna kenzie
`);

const MASC_WORDS = wordSet(`
  dad daddy papa pops pop father grandpa gramps gpa uncle brother bro husband
  hubby boy guy dude man king prince sir mr son him he gentleman
  john james jim jimmy mike michael matt matthew dave david chris christopher
  dan daniel danny joe joey joseph josh joshua tom tommy thomas will william
  bill billy bob bobby robert rob steve steven mark paul andrew andy drew ryan
  kevin brian jason justin eric adam nick nathan nate tyler kyle brandon aaron
  ben benjamin sam jake jacob luke jack noah liam ethan logan mason lucas henry
  owen caleb isaac george frank greg gary larry scott jeff tim timothy peter
  pete patrick sean shawn tony anthony charlie charles ed eddie edward carl kurt
  derek travis cody
`);

// Words that also count inside a longer one: at its end ("supermom",
// "granddad"), or, when long enough not to start other words, at its start
// ("queenofsketch", "mamabear")
const FEM_PARTS = ['mom', 'mommy', 'mama', 'girl', 'queen', 'lady', 'princess'];
const MASC_PARTS = [
  'dad',
  'daddy',
  'papa',
  'bro',
  'boy',
  'king',
  'dude',
  'guy',
];

const hasPart = (word: string, parts: Array<string>) =>
  parts.some(
    (part) =>
      word.endsWith(part) || (part.length >= 4 && word.startsWith(part)),
  );

/** The words in a username: "SuperMom_2kids" → ["super", "mom", "kids"] */
const words = (username: string) =>
  username
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

/**
 * A guess at which look fits a username, from words like "mom" or "dad" and
 * common first names. Undefined when there's no sign, or signs both ways.
 */
export const guessLook = (username: string): AvatarLook | undefined => {
  let fem = false;
  let masc = false;
  for (const word of words(username)) {
    fem ||= FEM_WORDS.has(word) || hasPart(word, FEM_PARTS);
    masc ||= MASC_WORDS.has(word) || hasPart(word, MASC_PARTS);
  }
  if (fem === masc) return undefined;
  return fem ? 'fem' : 'masc';
};

/** The face a user gets by default */
export const defaultAvatarFor = (user: {
  id: string;
  username: string;
}): AvatarParts => {
  const random = randomFrom(hash(user.id));
  // Drawn even when the name decides, so the other parts stay put either way
  const coin: AvatarLook = random() < 0.5 ? 'masc' : 'fem';
  const look = guessLook(user.username) ?? coin;
  return {
    look,
    hair: pick(HAIR[look], random),
    neckline: pick(NECKLINES, random),
    // Half go without, so a room of faces isn't mostly glasses
    glasses: random() < 0.5 ? 'none' : pick(GLASSES.slice(1), random),
    extra: pick(EXTRAS[look], random),
    tilt: Math.round((random() * 2 - 1) * 4),
  };
};
