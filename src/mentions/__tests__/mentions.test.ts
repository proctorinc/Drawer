import { describe, expect, it } from 'vitest';
import {
  judgeHandle,
  matchMentions,
  mentionAtCaret,
  mentionables,
  splitMentions,
} from '../mentions';
import type { AIJudge, User } from '@/api/Api';

describe('splitMentions', () => {
  it('finds mentions and leaves trailing punctuation as text', () => {
    expect(splitMentions('@jimbo, ask @SirDoodleton!')).toEqual([
      { text: '@jimbo', mention: true },
      { text: ', ask ', mention: false },
      { text: '@SirDoodleton', mention: true },
      { text: '!', mention: false },
    ]);
  });

  it('ignores emails and a bare @', () => {
    expect(splitMentions('mail a@b.com @ me')).toEqual([
      { text: 'mail a@b.com @ me', mention: false },
    ]);
  });
});

describe('mentionAtCaret', () => {
  it('finds the mention being typed', () => {
    expect(mentionAtCaret('hey @ji', 7)).toEqual({ start: 4, query: 'ji' });
    expect(mentionAtCaret('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('is null once the word is done, or mid-email', () => {
    expect(mentionAtCaret('@jimbo hi', 9)).toBeNull();
    expect(mentionAtCaret('a@b', 3)).toBeNull();
  });
});

it('makes a judge handle without spaces', () => {
  expect(judgeHandle('Sir Doodleton')).toBe('SirDoodleton');
});

describe('mentionables', () => {
  const user = (id: string, username: string) => ({ id, username }) as User;
  const judge = { name: 'Sir Doodleton' } as AIJudge;

  it('lists the judge first, then each other person once, never me', () => {
    const list = mentionables(
      judge,
      [user('1', 'ann'), user('2', 'me'), user('1', 'ann'), user('3', 'bob')],
      '2',
    );
    expect(list.map((m) => m.handle)).toEqual(['SirDoodleton', 'ann', 'bob']);
  });

  it('matches names starting with the query before ones containing it', () => {
    const list = mentionables(
      undefined,
      [user('1', 'jimbo'), user('2', 'benji')],
      'x',
    );
    expect(matchMentions(list, 'JI').map((m) => m.handle)).toEqual([
      'jimbo',
      'benji',
    ]);
    expect(matchMentions(list, '').length).toBe(2);
  });
});
