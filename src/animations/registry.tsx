/**
 * Which component plays each kind of stage item. The pin plays straight away
 * (it has to pick up from the canvas), so it's bundled; the rest load lazily
 * and are preloaded while idle.
 */
import { lazy } from 'react';
import { PinStage } from './PinStage';
import type { ComponentType } from 'react';
import type { StageKind, StageProps, TickerProps } from './types';

export type StageRegistry = {
  [K in StageKind]: ComponentType<StageProps<K>>;
};

const loaders = {
  review: () =>
    import('./ReviewStage').then((m) => ({ default: m.ReviewStage })),
  judgeIntro: () =>
    import('./JudgeIntroStage').then((m) => ({ default: m.JudgeIntroStage })),
  xp: () => import('./xp/XPPopdown').then((m) => ({ default: m.XPPopdown })),
  rankUp: () =>
    import('./rankUp/RankUpCelebration').then((m) => ({
      default: m.RankUpCelebration,
    })),
  completed: () =>
    import('./completed/CompletedCard').then((m) => ({
      default: m.CompletedCard,
    })),
  reward: () =>
    import('./completed/RewardReveal').then((m) => ({
      default: m.RewardReveal,
    })),
  announcements: () =>
    import('@/announcements/AnnouncementsStage').then((m) => ({
      default: m.AnnouncementsStage,
    })),
  drawingTips: () =>
    import('@/drawing/tips/DrawingTipsStage').then((m) => ({
      default: m.DrawingTipsStage,
    })),
  reviewTips: () =>
    import('@/ai/ReviewTipsStage').then((m) => ({
      default: m.ReviewTipsStage,
    })),
  ticker: () =>
    import('./xp/ProgressTicker').then((m) => ({ default: m.ProgressTicker })),
};

export const stageRegistry: StageRegistry = {
  pin: PinStage,
  review: lazy(loaders.review),
  judgeIntro: lazy(loaders.judgeIntro),
  xp: lazy(loaders.xp),
  rankUp: lazy(loaders.rankUp),
  completed: lazy(loaders.completed),
  reward: lazy(loaders.reward),
  announcements: lazy(loaders.announcements),
  drawingTips: lazy(loaders.drawingTips),
  reviewTips: lazy(loaders.reviewTips),
};

export const TickerComponent: ComponentType<TickerProps> = lazy(loaders.ticker);

/** Fetch every lazy animation's code ahead of time */
export const preloadStage = () => {
  Object.values(loaders).forEach((load) => {
    load().catch(() => {
      // Tried again, for real, when it's first played
    });
  });
};
