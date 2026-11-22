import { describe, expect, it } from 'vitest';
import { diffProgress, parseSnapshot } from '../progressDiff';
import type { ProgressSnapshot } from '../progressDiff';
import type { LevelSnapshot } from '../types';
import type { Achievement } from '@/api/Api';
import type { Quest } from '@/api/trophies';
import { xpToReach } from '@/levels/ranks';

function level(lvl: number, xp: number): LevelSnapshot {
  return {
    level: lvl,
    xp,
    levelStartXp: xpToReach(lvl),
    nextLevelXp: xpToReach(lvl + 1),
  };
}

function achievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 'a1',
    name: 'First doodle',
    description: 'Draw something',
    imageUrl: '/a1.png',
    achievedAt: null,
    achievementField: 'drawings',
    achievementValue: 5,
    progress: 0,
    reward: null,
    eventSlug: null,
    ...overrides,
  };
}

function quest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q1',
    title: 'Draw 3 times',
    description: '',
    progress: 0,
    goal: 3,
    ...overrides,
  };
}

const WEEK = '2026-11-16';

function snapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { level: null, achievements: null, quests: null, ...overrides };
}

describe('diffProgress', () => {
  it('records the first load without celebrating anything', () => {
    const result = diffProgress(null, {
      level: level(4, 320),
      achievements: [
        achievement({ achievedAt: new Date(), progress: 5 }),
        achievement({ id: 'a2', progress: 2 }),
      ],
      quests: { weekStart: WEEK, quests: [quest({ progress: 3 })] },
    });
    expect(result.stage).toEqual([]);
    expect(result.ticker).toEqual([]);
    expect(result.next).toEqual({
      level: level(4, 320),
      achievements: {
        a1: { progress: 5, achieved: true },
        a2: { progress: 2, achieved: false },
      },
      quests: { weekStart: WEEK, progress: { q1: 3 } },
    });
  });

  it('is a no-op when nothing changed', () => {
    const input = {
      level: level(2, 60),
      achievements: [achievement({ progress: 2 })],
      quests: { weekStart: WEEK, quests: [quest({ progress: 1 })] },
    };
    const first = diffProgress(null, input);
    const second = diffProgress(first.next, input);
    expect(second.stage).toEqual([]);
    expect(second.ticker).toEqual([]);
    expect(second.next).toEqual(first.next);
  });

  it('queues XP gained within a level, without a rank up', () => {
    const from = level(2, 60);
    const to = level(2, 80);
    const { stage, next } = diffProgress(snapshot({ level: from }), {
      level: to,
    });
    expect(stage).toEqual([
      { id: 'xp:80', kind: 'xp', payload: { from, to, gained: 20 } },
    ]);
    expect(next.level).toEqual(to);
  });

  it('rolls over several levels in one XP item, inside the same tier', () => {
    // Bronze runs 3–4; level 3 to 4 stays bronze
    const from = level(3, 160);
    const to = level(4, 310);
    const { stage } = diffProgress(snapshot({ level: from }), { level: to });
    expect(stage).toHaveLength(1);
    expect(stage[0]).toMatchObject({
      kind: 'xp',
      payload: { from, to, gained: 150 },
    });
  });

  it('adds a rank up after the XP item when the tier changes', () => {
    const from = level(2, 60); // graphite
    const to = level(5, 520); // silver
    const { stage } = diffProgress(snapshot({ level: from }), { level: to });
    expect(stage.map((item) => item.kind)).toEqual(['xp', 'rankUp']);
    expect(stage[1]).toEqual({
      id: 'rankUp:silver:5',
      kind: 'rankUp',
      payload: { fromTierId: 'graphite', toTierId: 'silver', level: 5 },
    });
  });

  it('records lower XP without celebrating', () => {
    const { stage, next } = diffProgress(snapshot({ level: level(3, 200) }), {
      level: level(2, 90),
    });
    expect(stage).toEqual([]);
    expect(next.level).toEqual(level(2, 90));
  });

  it('celebrates a completed sticker, then its reward', () => {
    const reward = { id: 'SANTA_HAT', name: 'Santa hat', description: '' };
    const sticker = achievement({
      id: 's1',
      eventSlug: 'doodlemas',
      achievedAt: new Date(),
      progress: 5,
      reward,
    });
    const { stage, ticker, next } = diffProgress(
      snapshot({ achievements: { s1: { progress: 4, achieved: false } } }),
      { achievements: [sticker] },
    );
    expect(ticker).toEqual([]);
    expect(stage).toEqual([
      {
        id: 'completed:sticker:s1',
        kind: 'completed',
        payload: { kind: 'sticker', achievement: sticker },
        group: 'earned:completed:sticker:s1',
      },
      {
        id: 'reward:SANTA_HAT:s1',
        kind: 'reward',
        payload: { reward, from: sticker },
        group: 'earned:completed:sticker:s1',
      },
    ]);
    expect(next.achievements).toEqual({ s1: { progress: 5, achieved: true } });
  });

  it('orders every completion, every reward, then the XP, then the rank up', () => {
    const reward = { id: 'R', name: 'R', description: '' };
    const a = achievement({ id: 'a', achievedAt: new Date(), reward });
    const b = achievement({ id: 'b', achievedAt: new Date(), reward });
    const { stage } = diffProgress(
      snapshot({
        level: level(2, 60),
        achievements: {
          a: { progress: 4, achieved: false },
          b: { progress: 4, achieved: false },
        },
        quests: { weekStart: WEEK, progress: { q1: 2 } },
      }),
      {
        level: level(3, 160),
        achievements: [a, b],
        quests: { weekStart: WEEK, quests: [quest({ progress: 3 })] },
      },
    );
    expect(stage.map((item) => item.id)).toEqual([
      'completed:achievement:a',
      'completed:achievement:b',
      `completed:quest:${WEEK}:q1`,
      'reward:R:a',
      'reward:R:b',
      'xp:160',
      'rankUp:bronze:3',
    ]);
    // One fill for everything earned
    expect(stage[5].payload).toEqual({
      from: level(2, 60),
      to: level(3, 160),
      gained: 100,
    });
  });

  it('holds tiny XP gains back until they add up', () => {
    const first = diffProgress(snapshot({ level: level(2, 60) }), {
      level: level(2, 63),
    });
    expect(first.stage).toEqual([]);
    // Remembers where the bar was, so the next gain counts from there
    expect(first.next.level).toEqual(level(2, 60));
    const second = diffProgress(first.next, { level: level(2, 66) });
    expect(second.stage).toEqual([
      {
        id: 'xp:66',
        kind: 'xp',
        payload: { from: level(2, 60), to: level(2, 66), gained: 6 },
      },
    ]);
  });

  it('shows a tiny gain that crosses a level', () => {
    const before = level(2, 149);
    const { stage } = diffProgress(snapshot({ level: before }), {
      level: level(3, 151),
    });
    expect(stage[0]).toMatchObject({ kind: 'xp', payload: { gained: 2 } });
  });

  it('pings only steps worth noticing on a big goal', () => {
    const big = (from: number, to: number) =>
      diffProgress(
        snapshot({ achievements: { a1: { progress: from, achieved: false } } }),
        {
          achievements: [achievement({ achievementValue: 100, progress: to })],
        },
      ).ticker.length;
    expect(big(0, 1)).toBe(1); // started
    expect(big(36, 37)).toBe(0); // nothing special
    expect(big(49, 50)).toBe(1); // a quarter
    expect(big(94, 95)).toBe(1); // home stretch
  });

  it('keeps the two pings nearest done and counts the rest', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const { ticker } = diffProgress(
      snapshot({
        achievements: Object.fromEntries(
          ids.map((id) => [id, { progress: 0, achieved: false }]),
        ),
      }),
      {
        achievements: ids.map((id, i) =>
          achievement({
            id,
            achievementField: id,
            achievementValue: 5,
            progress: i + 1,
          }),
        ),
      },
    );
    expect(ticker.map((t) => [t.id, t.more])).toEqual([
      ['achievementProgress:d:4', undefined],
      ['achievementProgress:c:3', 2],
    ]);
  });

  it('pings the ticker for progress that does not complete', () => {
    const { stage, ticker } = diffProgress(
      snapshot({
        achievements: {
          a1: { progress: 1, achieved: false },
          s1: { progress: 0, achieved: false },
        },
      }),
      {
        achievements: [
          achievement({ progress: 3 }),
          achievement({
            id: 's1',
            name: 'Snowman',
            imageUrl: '/s1.png',
            eventSlug: 'doodlemas',
            progress: 1,
            achievementValue: 10,
          }),
        ],
      },
    );
    expect(stage).toEqual([]);
    expect(ticker).toEqual([
      {
        id: 'achievementProgress:a1:3',
        kind: 'achievementProgress',
        label: 'First doodle',
        imageUrl: '/a1.png',
        from: 1,
        to: 3,
        goal: 5,
      },
      {
        id: 'stickerProgress:s1:1',
        kind: 'stickerProgress',
        label: 'Snowman',
        imageUrl: '/s1.png',
        from: 0,
        to: 1,
        goal: 10,
      },
    ]);
  });

  it("doesn't ping a better near miss on a one-shot achievement", () => {
    const judge = (progress: number) =>
      achievement({
        id: 'judge-best-10',
        achievementField: 'AI_BEST_SCORE',
        achievementValue: 10,
        progress,
      });
    const { stage, ticker } = diffProgress(
      snapshot({
        achievements: { 'judge-best-10': { progress: 5, achieved: false } },
      }),
      { achievements: [judge(7)] },
    );
    expect(stage).toEqual([]);
    expect(ticker).toEqual([]);
  });

  it('pings only the current step of a path', () => {
    const streak = (id: string, goal: number, progress: number) =>
      achievement({
        id,
        name: id,
        achievementField: 'SUBMISSION_STREAK',
        achievementValue: goal,
        progress,
      });
    const { ticker } = diffProgress(
      snapshot({
        achievements: {
          's-3': { progress: 3, achieved: true },
          's-14': { progress: 3, achieved: false },
          's-30': { progress: 3, achieved: false },
          's-100': { progress: 3, achieved: false },
          c1: { progress: 1, achieved: false },
        },
      }),
      {
        achievements: [
          { ...streak('s-3', 3, 4), achievedAt: new Date(), celebrated: true },
          streak('s-14', 14, 4),
          streak('s-30', 30, 4),
          streak('s-100', 100, 4),
          achievement({
            id: 'c1',
            achievementField: 'COMMENT_TOTAL',
            progress: 2,
          }),
        ],
      },
    );
    expect(ticker.map((t) => t.id)).toEqual([
      'achievementProgress:s-14:4',
      'achievementProgress:c1:2',
    ]);
  });

  it("skips a path's progress when one of its steps was just earned", () => {
    const { stage, ticker } = diffProgress(
      snapshot({
        achievements: {
          's-3': { progress: 2, achieved: false },
          's-14': { progress: 2, achieved: false },
        },
      }),
      {
        achievements: [
          achievement({
            id: 's-3',
            achievementField: 'SUBMISSION_STREAK',
            achievementValue: 3,
            progress: 3,
            achievedAt: new Date(),
            celebrated: false,
          }),
          achievement({
            id: 's-14',
            achievementField: 'SUBMISSION_STREAK',
            achievementValue: 14,
            progress: 3,
          }),
        ],
      },
    );
    expect(stage.map((item) => item.id)).toEqual(['completed:achievement:s-3']);
    expect(ticker).toEqual([]);
  });

  it('never pings a step past the current one, however close it is', () => {
    // An explicit path, made of different counts: the later step is further along
    const step = (
      id: string,
      pathStep: number,
      goal: number,
      progress: number,
    ) =>
      achievement({
        id,
        achievementField: id,
        achievementValue: goal,
        progress,
        path: 'social',
        pathStep,
      });
    const { ticker } = diffProgress(
      snapshot({
        achievements: {
          friends: { progress: 1, achieved: false },
          comments: { progress: 8, achieved: false },
        },
      }),
      { achievements: [step('comments', 2, 10, 9), step('friends', 1, 5, 2)] },
    );
    expect(ticker.map((t) => t.id)).toEqual(['achievementProgress:friends:2']);
  });

  it('remembers achievements it has never seen without celebrating them', () => {
    const { stage, ticker, next } = diffProgress(
      snapshot({ achievements: {} }),
      { achievements: [achievement({ achievedAt: new Date(), progress: 5 })] },
    );
    expect(stage).toEqual([]);
    expect(ticker).toEqual([]);
    expect(next.achievements).toEqual({ a1: { progress: 5, achieved: true } });
  });

  it('tracks quest progress and completion within a week', () => {
    const done = quest({
      id: 'q2',
      title: 'React 2 times',
      progress: 2,
      goal: 2,
    });
    const { stage, ticker } = diffProgress(
      snapshot({ quests: { weekStart: WEEK, progress: { q1: 0, q2: 1 } } }),
      {
        quests: { weekStart: WEEK, quests: [quest({ progress: 1 }), done] },
      },
    );
    expect(stage).toEqual([
      {
        id: `completed:quest:${WEEK}:q2`,
        kind: 'completed',
        payload: { kind: 'quest', quest: done },
      },
    ]);
    expect(ticker).toEqual([
      {
        id: `questProgress:${WEEK}:q1:1`,
        kind: 'questProgress',
        label: 'Draw 3 times',
        from: 0,
        to: 1,
        goal: 3,
      },
    ]);
  });

  it('does not re-celebrate a quest that goes past its goal', () => {
    const { stage, ticker } = diffProgress(
      snapshot({ quests: { weekStart: WEEK, progress: { q1: 3 } } }),
      { quests: { weekStart: WEEK, quests: [quest({ progress: 5 })] } },
    );
    expect(stage).toEqual([]);
    expect(ticker).toEqual([]);
  });

  it('resets quest memory when the week changes', () => {
    const nextWeek = '2026-11-23';
    const { stage, ticker, next } = diffProgress(
      snapshot({ quests: { weekStart: WEEK, progress: { q1: 3, old: 2 } } }),
      {
        quests: {
          weekStart: nextWeek,
          quests: [quest({ progress: 1 }), quest({ id: 'q3', progress: 0 })],
        },
      },
    );
    // Last week's q1 was complete, but this week's starts again from zero
    expect(stage).toEqual([]);
    expect(ticker).toEqual([
      expect.objectContaining({
        id: `questProgress:${nextWeek}:q1:1`,
        from: 0,
        to: 1,
      }),
    ]);
    expect(next.quests).toEqual({
      weekStart: nextWeek,
      progress: { q1: 1, q3: 0 },
    });
  });

  describe('when the server says what has been celebrated', () => {
    const earned = (overrides: Partial<Achievement> = {}) =>
      achievement({ achievedAt: new Date(), progress: 5, ...overrides });

    it('celebrates an uncelebrated one even on a device that has never looked', () => {
      const a = earned({ celebrated: false });
      const { stage } = diffProgress(null, { achievements: [a] });
      expect(stage).toEqual([
        {
          id: 'completed:achievement:a1',
          kind: 'completed',
          payload: { kind: 'achievement', achievement: a },
        },
      ]);
    });

    it('never replays a celebrated one, whatever this device remembers', () => {
      // A snapshot from another account (or a stale one) says it wasn't earned
      const { stage } = diffProgress(
        snapshot({ achievements: { a1: { progress: 0, achieved: false } } }),
        { achievements: [earned({ celebrated: true })] },
      );
      expect(stage).toEqual([]);
    });

    it('skips ones already queued or acknowledged here', () => {
      const { stage } = diffProgress(
        null,
        { achievements: [earned({ celebrated: false })] },
        { pending: new Set(['a1']) },
      );
      expect(stage).toEqual([]);
    });

    it('still pings progress by what this device last saw', () => {
      const { stage, ticker } = diffProgress(
        snapshot({ achievements: { a1: { progress: 1, achieved: false } } }),
        { achievements: [achievement({ progress: 3, celebrated: false })] },
      );
      expect(stage).toEqual([]);
      expect(ticker).toEqual([
        expect.objectContaining({
          id: 'achievementProgress:a1:3',
          from: 1,
          to: 3,
        }),
      ]);
    });
  });

  it('keeps sections that have not loaded yet', () => {
    const prev = snapshot({
      level: level(2, 60),
      quests: { weekStart: WEEK, progress: { q1: 1 } },
    });
    const { next } = diffProgress(prev, {
      achievements: [achievement()],
    });
    expect(next.level).toEqual(prev.level);
    expect(next.quests).toEqual(prev.quests);
    expect(next.achievements).toEqual({ a1: { progress: 0, achieved: false } });
  });
});

describe('parseSnapshot', () => {
  it('handles missing and malformed values', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot('null')).toBeNull();
    expect(parseSnapshot('{"level":null}')).toEqual(snapshot());
  });
});
