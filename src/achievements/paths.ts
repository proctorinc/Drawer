import type { Achievement } from '@/api/Api';

/**
 * Achievements line up in paths, each step leading to the next: 3 days in a
 * row, then 14, then 30. Only a path's current step, the first one not yet
 * completed, is in play. The steps after it wait their turn: they don't ping
 * their progress or show up next.
 */
export type AchievementPath = {
  id: string;
  /** In order, first step first */
  steps: Array<Achievement>;
  /** Index of the first step not completed; past the end when all are */
  current: number;
};

/**
 * The path an achievement is on. Older servers don't say, and then it's
 * everything counting the same thing (an event's stickers on their own).
 */
export function pathOf(achievement: Achievement): string {
  if (achievement.path) return achievement.path;
  if (!achievement.achievementField) return achievement.id;
  return `${achievement.eventSlug ?? ''}:${achievement.achievementField.toLowerCase()}`;
}

const stepOf = (a: Achievement) => a.pathStep ?? a.achievementValue;

/** Groups achievements into their paths, in the order each path first appears */
export function groupPaths(
  achievements: ReadonlyArray<Achievement>,
): Array<AchievementPath> {
  const byId = new Map<string, Array<Achievement>>();
  for (const achievement of achievements) {
    const id = pathOf(achievement);
    const steps = byId.get(id);
    if (steps) steps.push(achievement);
    else byId.set(id, [achievement]);
  }
  return [...byId].map(([id, steps]) => {
    steps.sort((a, b) => stepOf(a) - stepOf(b));
    const current = steps.findIndex((a) => !a.achievedAt);
    return { id, steps, current: current === -1 ? steps.length : current };
  });
}

/** Each path's current step: what's in play right now */
export function currentSteps(
  achievements: ReadonlyArray<Achievement>,
): Array<Achievement> {
  return groupPaths(achievements).flatMap((path) =>
    path.current < path.steps.length ? [path.steps[path.current]] : [],
  );
}
