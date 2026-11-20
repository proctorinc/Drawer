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

export type StageDemo = {
  lane: 'stage';
  kind: StageKind;
  payload: StagePayloads[StageKind];
};

export type AnimationDemo =
  | StageDemo
  | { lane: 'ticker'; item: TickerItem }
  /** Several earned at once: they play as a group, "1 of n" */
  | { lane: 'set'; items: Array<StageDemo> };

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
