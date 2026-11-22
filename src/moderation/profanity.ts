// Word-list profanity filter: no AI, no network. Finds swear words and slurs in user text so the UI
// can swap them for silly words. Matching is per word, so "class" and "Scunthorpe" stay clean.

// Whole words only. The site is for kids, so mild swears (hell, crap, damn) are in too.
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
  'bugger',
  'buggered',
  'bullshit',
  'butthole',
  'buttplug',
  'chink',
  'clit',
  'cock',
  'cocks',
  'cocksucker',
  'coon',
  'crap',
  'crapper',
  'crappy',
  'cum',
  'cumming',
  'cumshot',
  'cunt',
  'cunts',
  'dammit',
  'damnit',
  'dick',
  'dickhead',
  'dicks',
  'dildo',
  'douche',
  'douchebag',
  'dumbass',
  'dyke',
  'fag',
  'faggot',
  'faggots',
  'fags',
  'fck',
  'fcking',
  'ffs',
  'fuk',
  'fuking',
  'goddam',
  'goddammit',
  'gook',
  'gtfo',
  'handjob',
  'hell',
  'hella',
  'hellhole',
  'hoe',
  'hoes',
  'horny',
  'jackass',
  'jerkoff',
  'kike',
  'kys',
  'lmfao',
  'milf',
  'nazi',
  'negro',
  'nigga',
  'niggas',
  'nigger',
  'niggers',
  'nude',
  'nudes',
  'omfg',
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
  'turd',
  'turds',
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
  'damn',
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

// Each swear is swapped for a silly word of the same kind, so "this is fucking great" reads
// "this is flipping great". Kinds are a rough guess; close enough is the joke.
type Kind = 'noun' | 'nouns' | 'adjective' | 'ing' | 'exclaim';

export const SILLY: Record<Exclude<Kind, 'nouns'>, Array<string>> = {
  noun: [
    'noodle',
    'pickle',
    'potato',
    'waffle',
    'muffin',
    'banana',
    'pancake',
    'meatball',
    'sock',
    'turnip',
    'nugget',
    'cupcake',
    'marshmallow',
    'gumdrop',
    'jellybean',
    'pretzel',
    'dumpling',
    'burrito',
    'taco',
    'cabbage',
    'pumpkin',
    'walrus',
    'penguin',
    'platypus',
    'llama',
    'hamster',
    'unicorn',
    'dinosaur',
    'kazoo',
    'bubble',
    'button',
    'doodle',
    'teapot',
    'sprout',
    'pudding',
    'biscuit',
    'cheeseburger',
    'tadpole',
    'wombat',
    'narwhal',
    'sloth',
    'hedgehog',
    'cookie',
    'bagel',
    'cucumber',
    'lollipop',
    'popsicle',
    'sandwich',
    'gummy bear',
    'rubber duck',
    'tater tot',
    'meatloaf',
    'snickerdoodle',
    'pinecone',
    'coconut',
    'sea cucumber',
    'jelly donut',
    'spaghetti noodle',
  ],
  adjective: [
    'fluffy',
    'wiggly',
    'sparkly',
    'squishy',
    'bubbly',
    'jiggly',
    'bouncy',
    'wobbly',
    'cheesy',
    'giggly',
    'snuggly',
    'fuzzy',
    'sprinkly',
    'noodly',
    'goofy',
    'silly',
    'squeaky',
    'twinkly',
    'zippy',
    'wacky',
    'loopy',
    'puffy',
    'gooey',
    'crunchy',
    'toasty',
    'sneezy',
    'dizzy',
    'jolly',
    'cuddly',
    'zany',
    'peppy',
    'rainbowy',
    'frosty',
    'sunny',
    'marshmallowy',
    'bonkers',
    'fizzy',
    'glittery',
    'tickly',
    'waddly',
    'boingy',
    'sparkletastic',
  ],
  ing: [
    'flipping',
    'fudging',
    'honking',
    'tooting',
    'wiggling',
    'jiggling',
    'bonking',
    'booping',
    'giggling',
    'wobbling',
    'bouncing',
    'sneezing',
    'tickling',
    'twirling',
    'snorting',
    'squeaking',
    'hiccuping',
    'waddling',
    'galloping',
    'yodeling',
    'zooming',
    'sparkling',
    'bubbling',
    'cartwheeling',
    'moonwalking',
    'tap-dancing',
    'somersaulting',
    'quacking',
    'burping',
    'skedaddling',
  ],
  // Works as a shout, a verb or a noun: "oh fudge", "fudge off", "what the fudge"
  exclaim: [
    'fudge',
    'pickles',
    'fiddlesticks',
    'biscuits',
    'jellybeans',
    'sprinkles',
    'bananas',
    'noodles',
    'jeepers',
    'gadzooks',
    'zoinks',
    'cowabunga',
    'yikes',
    'shucks',
    'crumbs',
    'rats',
    'phooey',
    'gosh',
    'golly',
    'horsefeathers',
    'balderdash',
    'poppycock',
    'flapdoodle',
    'fiddle-faddle',
    'banana bread',
    'holy guacamole',
    'great googly moogly',
    'jumping jellyfish',
    'cheese and crackers',
    'sugarplums',
    'snickerdoodles',
    'rubber ducky',
    'meatballs',
    'cotton candy',
    'bubblegum',
    'sweet potato pie',
    'jiminy cricket',
    'son of a biscuit',
    'mother of pearl',
    'monkey muffins',
  ],
};

// "walrus" -> "walruses", "cookie" -> "cookies", "tater tot" -> "tater tots"
const plural = (noun: string) =>
  /(s|x|z|ch|sh)$/.test(noun)
    ? `${noun}es`
    : /[^aeiou]y$/.test(noun)
      ? `${noun.slice(0, -1)}ies`
      : noun === 'potato'
        ? 'potatoes'
        : `${noun}s`;

const EXCLAIM = new Set([
  'damn',
  'dammit',
  'damnit',
  'goddam',
  'goddamn',
  'goddammit',
  'hell',
  'crap',
  'fuck',
  'shit',
  'bullshit',
  'fck',
  'fuk',
  'bugger',
  'piss',
  'wtf',
  'omfg',
  'lmfao',
  'stfu',
  'gtfo',
  'ffs',
  'kys',
]);
const ADJECTIVE = new Set([
  'horny',
  'sexy',
  'nude',
  'retarded',
  'pissed',
  'buggered',
  'crappy',
  'hella',
  'badass',
]);

// Nouns that end like adjectives
const NOUN = new Set(['pussy', 'booty', 'titty', 'tranny', 'fuckery']);

function kindOf(word: string): Kind {
  if (NOUN.has(word)) return 'noun';
  if (EXCLAIM.has(word)) return 'exclaim';
  if (ADJECTIVE.has(word)) return 'adjective';
  if (word.endsWith('ing') || word.endsWith('in')) return 'ing';
  if (word.endsWith('ed') || word.endsWith('y') || word.endsWith('ie'))
    return 'adjective';
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4)
    return 'nouns';
  return 'noun';
}

// Seeded, not random: the same comment always shows the same swaps, but the same swear in
// another comment (or later in this one) usually gets a different silly word
const hash = (s: string) =>
  [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function matchCase(original: string, swap: string) {
  const letters = original.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase())
    return swap.toUpperCase();
  if (/^\p{Lu}/u.test(letters)) return swap[0].toUpperCase() + swap.slice(1);
  return swap;
}

/** The silly word that stands in for a swear: same kind of word, same capitals. */
export function sillySwap(word: string, seed = 0): string {
  // "f*ck": use the vowel that made it a swear, and "fuuuck" -> "fuck", so the kind guess sees the real word
  const variants = unmask(normalize(word)).flatMap(squeeze);
  const base =
    variants.find((w) => WORDS.has(w) || EXCLAIM.has(w)) ??
    variants.find((w) => STEMS.some((stem) => w.includes(stem))) ??
    variants[0];
  const kind = kindOf(base);
  const options = SILLY[kind === 'nouns' ? 'noun' : kind];
  const pick = options[Math.abs(hash(base) ^ seed) % options.length];
  return matchCase(word, kind === 'nouns' ? plural(pick) : pick);
}

export type Segment =
  | { text: string; profane: false }
  | { text: string; profane: true; swap: string };

// Letters, digits and leet symbols; ! and * only count inside a word so "fuck!" ends at the k.
const WORD = /[\p{L}\p{N}@$]+(?:[!*]+[\p{L}\p{N}@$]+)*/gu;

/** Splits text into runs, flagging each profane word with the silly word to show instead. */
export function findProfanity(text: string): Array<Segment> {
  const segments: Array<Segment> = [];
  let last = 0;
  const seed = hash(text);
  for (const match of text.matchAll(WORD)) {
    if (!isProfane(match[0])) continue;
    const start = match.index;
    if (start > last)
      segments.push({ text: text.slice(last, start), profane: false });
    segments.push({
      text: match[0],
      profane: true,
      swap: sillySwap(match[0], seed + match.index * 7919),
    });
    last = start + match[0].length;
  }
  if (last < text.length)
    segments.push({ text: text.slice(last), profane: false });
  return segments;
}
