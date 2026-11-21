/**
 * Pure diffing for the progress watcher: given what the user last saw and
 * what the server says now, work out which celebrations to queue and what to
 * remember next time. No React, no storage, so it's easy to test.
 *
 * Each section (level, achievements, quests) is remembered on its own. A
 * section seen for the first time is only recorded, never celebrated, so a
 * new device or a cleared cache doesn't replay everything you've ever earned.
 *
 * Earning an achievement or sticker is the exception: the server says whether
 * it has been celebrated yet (on any device), so it plays exactly once per
 * account, however many devices you use. Only progress pings still go by
 * what this device last saw.
 */
import type { LevelSnapshot, StageItem, TickerItem } from './types';
import type { Achievement } from '@/api/Api';
import type { Quest } from '@/api/trophies';
import { rankFor } from '@/levels/ranks';

export type AchievementMemory = { progress: number; achieved: boolean };

export type ProgressSnapshot = {
  level: LevelSnapshot | null;
  /** By achievement (and sticker) id */
  achievements: Record<string, AchievementMemory> | null;
  /** Quest progress by quest id, for the week starting `weekStart` */
  quests: { weekStart: string; progress: Record<string, number> } | null;
};

export const EMPTY_SNAPSHOT: ProgressSnapshot = {
  level: null,
  achievements: null,
  quests: null,
};

/** What's loaded right now; leave a section out while it's still loading */
export type ProgressInput = {
  level?: LevelSnapshot | null;
  achievements?: Array<Achievement> | null;
  quests?: { weekStart: string; quests: Array<Quest> } | null;
};

/** XP gains smaller than this wait, adding up, until there's enough to show */
export const MIN_XP_POPDOWN = 5;

/** At most this many progress pings per refresh; the rest become "+n more" */
export const MAX_PINGS = 2;

export type ProgressDiff = {
  /**
   * In play order: completed..., reward..., xp, rankUp. Everything earned
   * plays first, then the bar fills with the XP for all of it, then a
   * rank-up if that XP crossed into a new tier.
   */
  stage: Array<StageItem>;
  ticker: Array<TickerItem>;
  next: ProgressSnapshot;
};

export type DiffOptions = {
  /**
   * Achievement ids already queued or acknowledged here, whose celebrated flag
   * the server may not reflect yet. They aren't queued again.
   */
  pending?: ReadonlySet<string>;
};

export function diffProgress(
  previous: ProgressSnapshot | null | undefined,
  current: ProgressInput,
  { pending }: DiffOptions = {},
): ProgressDiff {
  const prev = previous ?? EMPTY_SNAPSHOT;
  let xp: StageItem<'xp'> | undefined;
  let rankUp: StageItem<'rankUp'> | undefined;
  const completed: Array<StageItem> = [];
  const rewards: Array<StageItem> = [];
  const ticker: Array<TickerItem> = [];
  const next: ProgressSnapshot = { ...prev };

  // XP and rank
  if (current.level) {
    const from = prev.level;
    const to = pickLevel(current.level);
    // A small gain that stays in the same level waits for more to join it:
    // remembering the old level means the next diff counts from there
    const tiny =
      !!from && to.xp - from.xp < MIN_XP_POPDOWN && to.level === from.level;
    if (from && to.xp > from.xp && !tiny) {
      xp = {
        id: `xp:${to.xp}`,
        kind: 'xp',
        payload: { from, to, gained: to.xp - from.xp },
      };
      const fromTier = rankFor(from.level);
      const toTier = rankFor(to.level);
      if (fromTier.id !== toTier.id) {
        rankUp = {
          id: `rankUp:${toTier.id}:${to.level}`,
          kind: 'rankUp',
          payload: {
            fromTierId: fromTier.id,
            toTierId: toTier.id,
            level: to.level,
          },
        };
      }
    }
    next.level = tiny ? from : to;
  }

  // Achievements and event stickers
  if (current.achievements) {
    const seen = prev.achievements;
    const memory: Record<string, AchievementMemory> = {};
    // Progress pings, at most one per ladder (see ladderKey)
    const pings = new Map<string, TickerItem>();
    const ladderEarned = new Set<string>();
    for (const achievement of current.achievements) {
      const now: AchievementMemory = {
        progress: achievement.progress,
        achieved: !!achievement.achievedAt,
      };
      memory[achievement.id] = now;
      const kind = achievement.eventSlug ? 'sticker' : 'achievement';
      const was = seen?.[achievement.id];

      // The server knows whether it has played anywhere yet; an older server
      // doesn't say, and then it goes by what this device last saw
      const tracked = typeof achievement.celebrated === 'boolean';
      const earned = tracked
        ? now.achieved &&
          !achievement.celebrated &&
          !pending?.has(achievement.id)
        : !!was && now.achieved && !was.achieved;

      const ladder = ladderKey(achievement);
      if (earned) {
        ladderEarned.add(ladder);
        completed.push({
          id: `completed:${kind}:${achievement.id}`,
          kind: 'completed',
          payload: { kind, achievement },
        });
        if (achievement.reward) {
          rewards.push({
            id: `reward:${achievement.reward.id}:${achievement.id}`,
            kind: 'reward',
            payload: { reward: achievement.reward, from: achievement },
          });
        }
      } else if (was && !now.achieved && now.progress > was.progress) {
        const tickerKind =
          kind === 'sticker' ? 'stickerProgress' : 'achievementProgress';
        const ping: TickerItem = {
          id: `${tickerKind}:${achievement.id}:${now.progress}`,
          kind: tickerKind,
          label: achievement.name,
          imageUrl: achievement.imageUrl || undefined,
          from: was.progress,
          to: now.progress,
          goal: achievement.achievementValue,
        };
        // The lowest rung decides; a farther one never stands in for it
        const other = pings.get(ladder);
        if (!other || closer(ping, other)) pings.set(ladder, ping);
      }
    }
    // Earning a tier is the news; the next tier's progress can wait
    for (const [ladder, ping] of pings) {
      if (!ladderEarned.has(ladder) && worthPinging(ping)) ticker.push(ping);
    }
    next.achievements = memory;
  }

  // Weekly quests
  if (current.quests) {
    const { weekStart, quests } = current.quests;
    const seen = prev.quests;
    // A new week starts every quest from zero; the very first load doesn't count
    const sameWeek = seen?.weekStart === weekStart;
    const progress: Record<string, number> = {};
    for (const quest of quests) {
      const now = Math.min(quest.progress, quest.goal);
      progress[quest.id] = now;
      if (!seen) continue;
      let was: number;
      if (sameWeek) {
        // A quest that wasn't there before (the list moved to an event page)
        if (!(quest.id in seen.progress)) continue;
        was = seen.progress[quest.id];
      } else {
        was = 0;
      }
      if (now <= was) continue;
      if (now >= quest.goal) {
        completed.push({
          id: `completed:quest:${weekStart}:${quest.id}`,
          kind: 'completed',
          payload: { kind: 'quest', quest },
        });
      } else {
        const ping: TickerItem = {
          id: `questProgress:${weekStart}:${quest.id}:${now}`,
          kind: 'questProgress',
          label: quest.title,
          from: was,
          to: now,
          goal: quest.goal,
        };
        if (worthPinging(ping)) ticker.push(ping);
      }
    }
    next.quests = { weekStart, progress };
  }

  // Everything earned in one go plays as a set ("2 of 5"), then the bar fills
  // once with the XP for all of it, then a rank-up as the payoff. The queue
  // keeps that order even when more is earned while it plays.
  const earned = [...completed, ...rewards];
  const group = earned.length > 1 ? `earned:${earned[0].id}` : undefined;
  const stage: Array<StageItem> = earned.map((item) => ({ ...item, group }));
  if (xp) stage.push(xp);
  if (rankUp) stage.push(rankUp);
  return { stage, ticker: capPings(ticker), next };
}

/**
 * Achievements that count the same thing at rising goals (3, 14, 30 and 100
 * days in a row; 25 and 100 comments) form a ladder. One action moves every
 * rung at once, but only the next rung up is worth a ping.
 */
function ladderKey(achievement: Achievement): string {
  if (!achievement.achievementField) return `id:${achievement.id}`;
  return `${achievement.eventSlug ?? ''}:${achievement.achievementField}`;
}

/** Whether a is nearer its goal than b (the lower rung, on a ladder) */
function closer(a: TickerItem, b: TickerItem): boolean {
  const ra = a.goal > 0 ? a.to / a.goal : 1;
  const rb = b.goal > 0 ? b.to / b.goal : 1;
  return ra !== rb ? ra > rb : a.goal < b.goal;
}

/**
 * Whether a step is worth a ping. Small goals always are. Big ones ping when
 * they start, at each quarter, and on the home stretch, so 37 of 100 stays
 * quiet but 50 of 100 and 95 of 100 don't.
 */
export function worthPinging({ from, to, goal }: TickerItem): boolean {
  if (goal <= 10) return true;
  if (from === 0) return true;
  if (Math.floor((to * 4) / goal) > Math.floor((from * 4) / goal)) return true;
  return goal - to <= Math.max(1, Math.ceil(goal * 0.1));
}

/** The nearest MAX_PINGS to done, the last one counting the rest */
function capPings(pings: Array<TickerItem>): Array<TickerItem> {
  if (pings.length <= MAX_PINGS) return pings;
  const kept = [...pings].sort((a, b) =>
    closer(a, b) ? -1 : closer(b, a) ? 1 : 0,
  );
  kept.length = MAX_PINGS;
  const last = kept[MAX_PINGS - 1];
  kept[MAX_PINGS - 1] = { ...last, more: pings.length - MAX_PINGS };
  return kept;
}

function pickLevel(level: LevelSnapshot): LevelSnapshot {
  return {
    level: level.level,
    xp: level.xp,
    levelStartXp: level.levelStartXp,
    nextLevelXp: level.nextLevelXp,
  };
}

/** Parses a stored snapshot, tolerating anything malformed */
export function parseSnapshot(raw: string | null): ProgressSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProgressSnapshot> | null;
    if (!value || typeof value !== 'object') return null;
    return {
      level: value.level ?? null,
      achievements: value.achievements ?? null,
      quests: value.quests ?? null,
    };
  } catch {
    return null;
  }
}
