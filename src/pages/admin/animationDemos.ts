/**
 * Sample payloads for previewing celebrations in the admin. They're built from
 * the real rules (xpToReach, the tiers, an achievement's own data) so each
 * preview looks like what a player would actually see.
 */
import type { Achievement } from '@/api/Api';
import type { Quest } from '@/api/trophies';
import type {
  LevelSnapshot,
  StageItem,
  StageKind,
  StagePayloads,
  TickerItem,
} from '@/animations/types';
import { RANK_TIERS, xpToReach } from '@/levels/ranks';
import { diffProgress } from '@/animations/progressDiff';

export type StageDemo = {
  lane: 'stage';
  kind: StageKind;
  payload: StagePayloads[StageKind];
};

export type AnimationDemo =
  | StageDemo
  | { lane: 'ticker'; item: TickerItem }
  /** Several earned at once: they play as a group, "1 of n" */
  | { lane: 'set'; items: Array<StageDemo> }
  /** What the progress watcher queues for a busy moment, through the real queue */
  | { lane: 'burst'; stage: Array<StageItem>; ticker: Array<TickerItem> };

const stage = <TKind extends StageKind>(
  kind: TKind,
  payload: StagePayloads[TKind],
): StageDemo => ({ lane: 'stage', kind, payload });

/** Where you'd stand with `xp` total */
export function snapshotAt(xp: number): LevelSnapshot {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  return {
    level,
    xp,
    levelStartXp: xpToReach(level),
    nextLevelXp: xpToReach(level + 1),
  };
}

/**
 * Gaining `gained` XP starting `into` of the way through `level` (0–1). Lands
 * wherever that XP really takes you, rolling over levels and ranks.
 */
export function xpDemo(level: number, gained: number, into = 0.6) {
  const start = xpToReach(level);
  const from = snapshotAt(
    Math.round(start + (xpToReach(level + 1) - start) * into),
  );
  return stage('xp', { from, to: snapshotAt(from.xp + gained), gained });
}

/** Just enough XP to tip over into the next level */
export function levelUpDemo(level: number) {
  const cost = xpToReach(level + 1) - xpToReach(level);
  return xpDemo(level, Math.round(cost * 0.1) + 20, 0.9);
}

/** Crossing into tier `index` from the one below */
export function rankUpDemo(index: number) {
  const tier = RANK_TIERS[index];
  return stage('rankUp', {
    fromTierId: RANK_TIERS[index - 1].id,
    toTierId: tier.id,
    level: tier.from,
  });
}

const earned = (a: Achievement): Achievement => ({
  ...a,
  achievedAt: new Date(),
  progress: a.achievementValue,
});

export const achievementCompletedDemo = (a: Achievement) =>
  stage('completed', {
    kind: a.eventSlug ? 'sticker' : 'achievement',
    achievement: earned(a),
  });

export const achievementProgressDemo = (a: Achievement): AnimationDemo => {
  const goal = a.achievementValue;
  const to = Math.max(1, Math.min(goal - 1, Math.ceil(goal * 0.6)));
  return {
    lane: 'ticker',
    item: {
      id: `demo:${a.id}`,
      kind: a.eventSlug ? 'stickerProgress' : 'achievementProgress',
      label: a.name,
      imageUrl: a.imageUrl || undefined,
      from: to - 1,
      to,
      goal,
    },
  };
};

export const rewardDemo = (a: Achievement) =>
  a.reward ? stage('reward', { reward: a.reward, from: earned(a) }) : null;

export const questCompletedDemo = (quest: Quest) =>
  stage('completed', {
    kind: 'quest',
    quest: { ...quest, progress: quest.goal },
  });

export const questProgressDemo = (quest: Quest): AnimationDemo => {
  const to = Math.max(1, Math.min(quest.goal - 1, Math.ceil(quest.goal / 2)));
  return {
    lane: 'ticker',
    item: {
      id: `demo:${quest.id}`,
      kind: 'questProgress',
      label: quest.title,
      from: to - 1,
      to,
      goal: quest.goal,
    },
  };
};

/**
 * Earning all of these at once, the way the progress watcher queues it: every
 * completion, then every reward they unlock. A single one isn't a set.
 */
export function earnedAllDemo(
  achievements: Array<Achievement>,
  quests: Array<Quest> = [],
): AnimationDemo | null {
  const completions = [
    ...achievements.map(achievementCompletedDemo),
    ...quests.map(questCompletedDemo),
  ];
  const rewards = achievements
    .map(rewardDemo)
    .filter((demo): demo is StageDemo => !!demo);
  const items = [...completions, ...rewards];
  if (items.length < 2) return null;
  return { lane: 'set', items };
}

/** The same demo as a real queue item, to play it full size on this screen */
export function toStageItem(demo: StageDemo, group?: string): StageItem {
  return {
    id: `admin-demo:${demo.kind}:${Date.now()}:${Math.random()}`,
    kind: demo.kind,
    payload: demo.payload,
    group,
  } as StageItem;
}

const sample = (
  id: string,
  name: string,
  field: string,
  goal: number,
  progress: number,
  extra: Partial<Achievement> = {},
): Achievement => ({
  id,
  name,
  description: '',
  imageUrl: '',
  achievedAt: null,
  achievementField: field,
  achievementValue: goal,
  progress,
  reward: null,
  eventSlug: null,
  category: 'drawing',
  hidden: false,
  secret: false,
  celebrated: false,
  ...extra,
});

/**
 * One busy moment, run through the real diff so it queues exactly what a
 * player would get: you draw on day 4 of a streak and finish a quest, which
 * earns two achievements (one with a reward) and enough XP to rank up, while
 * a pile of progress moves underneath.
 */
export function burstDemo(quests: Array<Quest>): AnimationDemo {
  const level = RANK_TIERS[1].from - 1;
  const before = snapshotAt(xpToReach(level + 1) - 30);
  const quest = quests.at(0);
  const after = snapshotAt(before.xp + 25 + 25 + 10 + (quest ? 15 : 0));

  // What this device last saw, then what the server says now
  const was = (progress: number) => ({ progress, achieved: false });
  const achievements = [
    sample('demo-doodle-25', 'quarter century', 'SUBMISSION_TOTAL', 25, 25, {
      achievedAt: new Date(),
    }),
    sample('demo-pinned-3', 'gallery wall', 'FAVORITE_TOTAL', 3, 3, {
      achievedAt: new Date(),
      reward: {
        id: 'SWEATBAND',
        name: 'Sweatband',
        description: 'A sweatband for hard work',
      },
    }),
    // A streak ladder: only the next rung up pings
    sample('demo-streak-3', 'warming up', 'SUBMISSION_STREAK', 3, 4, {
      achievedAt: new Date(),
      celebrated: true,
    }),
    sample('demo-streak-14', 'two weeks strong', 'SUBMISSION_STREAK', 14, 4),
    sample('demo-streak-30', 'monthly regular', 'SUBMISSION_STREAK', 30, 4),
    sample('demo-streak-100', 'unstoppable', 'SUBMISSION_STREAK', 100, 4),
    sample(
      'demo-doodle-250',
      'sketchbook hoarder',
      'SUBMISSION_TOTAL',
      250,
      25,
    ),
    sample(
      'demo-received-50',
      'crowd pleaser',
      'REACTION_RECEIVED_TOTAL',
      50,
      38,
    ),
    sample('demo-comment-25', 'chatterbox', 'COMMENT_TOTAL', 25, 24),
    // 37 of 100 is nothing special, so it stays quiet
    sample('demo-reaction-100', 'hype machine', 'REACTION_TOTAL', 100, 37),
  ];
  const previous = {
    'demo-doodle-25': was(24),
    'demo-pinned-3': was(2),
    'demo-streak-3': { progress: 3, achieved: true },
    'demo-streak-14': was(3),
    'demo-streak-30': was(3),
    'demo-streak-100': was(3),
    'demo-doodle-250': was(24),
    'demo-received-50': was(37),
    'demo-comment-25': was(23),
    'demo-reaction-100': was(36),
  };
  const week = '2026-11-16';
  const queued = diffProgress(
    {
      level: before,
      achievements: previous,
      quests: quest
        ? { weekStart: week, progress: { [quest.id]: quest.goal - 1 } }
        : null,
    },
    {
      level: after,
      achievements,
      quests: quest
        ? { weekStart: week, quests: [{ ...quest, progress: quest.goal }] }
        : undefined,
    },
  );
  return { lane: 'burst', stage: queued.stage, ticker: queued.ticker };
}
