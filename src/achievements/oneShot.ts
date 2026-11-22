import type { Achievement } from '@/api/Api';

/**
 * Fields whose goal is one result clearing a bar, not a count that adds up:
 * a 7 from a judge isn't 7/10 of the way to scoring a 10. Progress on these
 * is just your best so far.
 */
const ONE_SHOT_FIELDS = new Set(['AI_BEST_SCORE']);

/** Whether an achievement is earned in one go, so it has no progress to show */
export function isOneShot(achievement: Pick<Achievement, 'achievementField'>) {
  return ONE_SHOT_FIELDS.has(achievement.achievementField);
}
