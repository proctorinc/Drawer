import { describe, expect, it } from 'vitest';
import { findProfanity, isProfane } from '../profanity';

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
    'stupid',
    'Idiot',
    'loser',
    'dumb',
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
    'stupendous',
    'closer',
  ])('leaves %s alone', (word) => expect(isProfane(word)).toBe(false));
});

describe('findProfanity', () => {
  it('splits out only the bad words, keeping punctuation outside', () => {
    expect(findProfanity('wow, fuck! nice shit')).toEqual([
      { text: 'wow, ', profane: false },
      { text: 'fuck', profane: true },
      { text: '! nice ', profane: false },
      { text: 'shit', profane: true },
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
