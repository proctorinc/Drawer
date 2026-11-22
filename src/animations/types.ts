/**
 * The contract every celebration shares. Two lanes:
 *
 * - The stage: one full-attention animation at a time, in the order they were
 *   queued. Each must call `onDone` when it finishes (or is tapped away);
 *   only then does the next one start.
 * - The ticker: small, non-blocking pings at the top of the screen (sticker
 *   or quest progress). They never wait for, or hold up, the stage.
 *
 * XP takes its turn in the stage's line, after whatever was earned ahead of
 * it, and pops down at the top while it plays. Pings wait until no cards are
 * on stage, so they land with the XP rather than over a celebration.
 */
import type { FC } from 'react';
import type { Achievement, AchievementReward } from '@/api/Api';
import type { Quest } from '@/api/trophies';
import type { Announcement } from '@/announcements/api';
import type { JudgeIntro } from '@/ai/JudgeIntro';

/** A level snapshot, the same shape /trophies returns */
export type LevelSnapshot = {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
};

export type StagePayloads = {
  /** The pin ceremony after you submit a doodle */
  pin: {
    imageUrl: string;
    from: { x: number; y: number; width: number; height: number };
  };
  /** An AI judge speaking its review */
  review: { submissionId: string };
  /** Today's judge asking you, in character, to draw today's prompt */
  judgeIntro: { intro: JudgeIntro };
  /**
   * Top popdown: the level bar filling from `from` to `to`, rolling over
   * levels. Plays at once, over whatever is on stage, rather than in line.
   */
  xp: { from: LevelSnapshot; to: LevelSnapshot; gained: number };
  /** Full screen: you crossed into a new rank tier (RANK_TIERS id) */
  rankUp: { fromTierId: string; toTierId: string; level: number };
  /** Centered card: a sticker, achievement or quest was completed */
  completed:
    | { kind: 'sticker' | 'achievement'; achievement: Achievement }
    | { kind: 'quest'; quest: Quest };
  /** Big and centered: a reward was unlocked, with a button to go use or see it */
  reward: { reward: AchievementReward; from: Achievement };
  /** Full screen: what's new, one page per announcement */
  announcements: {
    announcements: Array<Announcement>;
    /** The ones to record as seen once it's up (the unseen ones, when it pops up on its own) */
    markSeen?: Array<string>;
    /** An admin trying one out: nothing is recorded and buttons just close it */
    preview?: boolean;
  };
};

export type StageKind = keyof StagePayloads;

export type StageItem<TKind extends StageKind = StageKind> = {
  /** Stable id; queueing an id that's already waiting or playing is a no-op */
  id: string;
  kind: TKind;
  payload: StagePayloads[TKind];
  /**
   * Hold the queue at this item until the promise settles (for example, an AI
   * review that's still being written). Rejects or times out → skipped.
   */
  ready?: Promise<unknown>;
  /** How long `ready` may hold the line, if not the stage's usual timeout */
  readyTimeoutMs?: number;
  /**
   * Items that share a group were earned together (a batch of stickers,
   * quests and their rewards) and play as "2 of 5", one after another.
   */
  group?: string;
};

/** Where an item sits in its group; only set when the group has more than one */
export type StageStep = { index: number; total: number };

/** Props every stage animation component receives */
export type StageProps<TKind extends StageKind> = {
  payload: StagePayloads[TKind];
  /** Call exactly once when finished or dismissed */
  onDone: () => void;
  /** Set when this is one of several earned together */
  step?: StageStep;
  /** Close this and drop everything still waiting to celebrate */
  onSkipAll?: () => void;
};

export type StageComponent<TKind extends StageKind> = FC<StageProps<TKind>>;

export type TickerItem = {
  id: string;
  kind: 'stickerProgress' | 'questProgress' | 'achievementProgress';
  label: string;
  imageUrl?: string;
  from: number;
  to: number;
  goal: number;
  /** How many other pings were dropped to keep this refresh to a couple */
  more?: number;
};

export type TickerProps = { item: TickerItem; onDone: () => void };
