import { describe, expect, it } from 'vitest';
import { FACE_COUNT, HAIR, defaultAvatarFor, guessLook } from '../sketchFace';

describe('guessLook', () => {
  it.each([
    ['mom', 'fem'],
    ['SuperMom_2kids', 'fem'],
    ['nana_rose', 'fem'],
    ['queenofsketch', 'fem'],
    ['jenny.doodles', 'fem'],
    ['dad', 'masc'],
    ['granddad', 'masc'],
    ['papaBear', 'masc'],
    ['mike_draws', 'masc'],
    ['coolguy42', 'masc'],
    ['bigbro', 'masc'],
  ] as const)('%s → %s', (name, look) => {
    expect(guessLook(name)).toBe(look);
  });

  it.each([
    'pixelwizard',
    'moment',
    'momentum',
    'doodlebug',
    'mom_and_dad',
    '',
  ])('has no guess for %j', (name) => {
    expect(guessLook(name)).toBeUndefined();
  });
});

describe('defaultAvatarFor', () => {
  it('gives the same user the same face every time', () => {
    const user = { id: 'abc-123', username: 'inkspot' };
    expect(defaultAvatarFor(user)).toEqual(defaultAvatarFor(user));
  });

  it('dresses a "mom" from the fem hair', () => {
    for (let i = 0; i < 50; i++) {
      const face = defaultAvatarFor({ id: `user-${i}`, username: 'mom' });
      expect(face.look).toBe('fem');
      expect(HAIR.fem).toContain(face.hair);
    }
  });

  it('spreads users across many faces', () => {
    const faces = new Set(
      Array.from({ length: 2000 }, (_, i) =>
        JSON.stringify(
          defaultAvatarFor({ id: `user-${i}`, username: 'pixelwizard' }),
        ),
      ),
    );
    expect(FACE_COUNT).toBe(600);
    // Tilt makes faces look more distinct than the 600 parts alone
    expect(faces.size).toBeGreaterThan(1500);
  });
});
