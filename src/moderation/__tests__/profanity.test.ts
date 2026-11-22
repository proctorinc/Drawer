import { describe, expect, it } from 'vitest';
import { SILLY, findProfanity, isProfane, sillySwap } from '../profanity';

describe('isProfane', () => {
  it.each([
    'fuck',
    'FUCK',
    'motherfucker',
    'shitty',
    'fuuuuck',
    'sh!t',
    'f*ck',
    'a$$',
    'b1tch',
    'asss',
    'damn',
    'DAMN',
    'goddamn',
    'damned',
    'hell',
    'crap',
    'crappy',
  ])('flags %s', (word) => expect(isProfane(word)).toBe(true));

  it.each([
    'class',
    'grass',
    'bass',
    'as',
    'cocktail',
    'peacock',
    'Dickens',
    'Scunthorpe',
    'shiitake',
    'raccoon',
    'cocoon',
    'spicy',
    'hello',
    'swanky',
    'assess',
    'shell',
    'scrap',
    'condemn',
    'stupid',
    'idiot',
    'loser',
  ])('leaves %s alone', (word) => expect(isProfane(word)).toBe(false));
});

describe('findProfanity', () => {
  it('splits out only the bad words, keeping punctuation outside', () => {
    expect(findProfanity('wow, fuck! nice shit')).toEqual([
      { text: 'wow, ', profane: false },
      { text: 'fuck', profane: true, swap: expect.any(String) },
      { text: '! nice ', profane: false },
      { text: 'shit', profane: true, swap: expect.any(String) },
    ]);
  });

  it('returns clean text as one segment', () => {
    expect(findProfanity('love this cat')).toEqual([
      { text: 'love this cat', profane: false },
    ]);
  });

  it('handles empty text', () => {
    expect(findProfanity('')).toEqual([]);
  });
});

describe('sillySwap', () => {
  it.each([
    ['damn', 'exclaim'],
    ['f*ck', 'exclaim'],
    ['fucking', 'ing'],
    ['fuckin', 'ing'],
    ['shitty', 'adjective'],
    ['dick', 'noun'],
    ['pussy', 'noun'],
  ] as const)('swaps %s for a silly %s', (word, kind) => {
    for (let seed = 0; seed < 50; seed++)
      expect(SILLY[kind]).toContain(sillySwap(word, seed));
  });

  it('makes plural swears plural', () => {
    expect(sillySwap('dicks')).toMatch(/s$/);
    expect(SILLY.noun.map((n) => n.slice(0, 4))).toContain(
      sillySwap('dicks').slice(0, 4),
    );
  });

  it('gives the same word and seed the same swap', () =>
    expect(sillySwap('shit', 3)).toBe(sillySwap('shit', 3)));

  it('keeps capitals', () => {
    expect(sillySwap('DAMN')).toBe(sillySwap('damn').toUpperCase());
    expect(sillySwap('Damn')[0]).toMatch(/[A-Z]/);
  });
});

describe('findProfanity swaps', () => {
  const swaps = (text: string) =>
    findProfanity(text).flatMap((s) => (s.profane ? [s.swap] : []));

  it('shows the same swaps every time for the same comment', () =>
    expect(swaps('oh shit what the hell')).toEqual(
      swaps('oh shit what the hell'),
    ));

  it('mixes up the swap for the same swear across comments', () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => swaps(`shit ${i}`)[0]),
    );
    expect(seen.size).toBeGreaterThan(5);
  });
});
