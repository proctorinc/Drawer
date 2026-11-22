import { describe, expect, it } from 'vitest';
import { currentSteps, groupPaths } from '../paths';
import type { Achievement } from '@/api/Api';

const a = (id: string, overrides: Partial<Achievement> = {}): Achievement =>
  ({
    id,
    name: id,
    description: '',
    imageUrl: '',
    achievedAt: null,
    achievementField: 'SUBMISSION_STREAK',
    achievementValue: 1,
    progress: 0,
    reward: null,
    eventSlug: null,
    ...overrides,
  }) as Achievement;

const done = { achievedAt: new Date() };

describe('achievement paths', () => {
  it('lines steps up by their place on the path', () => {
    const [path] = groupPaths([
      a('s-30', { path: 'streak', pathStep: 3 }),
      a('s-3', { path: 'streak', pathStep: 1, ...done }),
      a('s-14', { path: 'streak', pathStep: 2 }),
    ]);
    expect(path.steps.map((s) => s.id)).toEqual(['s-3', 's-14', 's-30']);
    expect(path.current).toBe(1);
  });

  it('is past the end once every step is completed', () => {
    const [path] = groupPaths([a('x', { path: 'p', pathStep: 1, ...done })]);
    expect(path.current).toBe(1);
  });

  it('falls back to the counted field when the server sends no path', () => {
    const paths = groupPaths([
      a('s-14', { achievementValue: 14 }),
      a('s-3', { achievementValue: 3 }),
      a('xmas', { achievementValue: 3, eventSlug: 'doodlemas' }),
    ]);
    expect(paths.map((p) => p.steps.map((s) => s.id))).toEqual([
      ['s-3', 's-14'],
      ['xmas'],
    ]);
  });

  it('keeps only the current step of each path in play', () => {
    expect(
      currentSteps([
        a('s-3', { path: 'streak', pathStep: 1, ...done }),
        a('s-14', { path: 'streak', pathStep: 2 }),
        a('s-30', { path: 'streak', pathStep: 3 }),
        a('poke', { path: 'poke', pathStep: 1, ...done }),
        a('friend', { path: 'friend', pathStep: 1 }),
      ]).map((s) => s.id),
    ).toEqual(['s-14', 'friend']);
  });
});
