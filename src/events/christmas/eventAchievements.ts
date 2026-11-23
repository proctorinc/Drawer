import type { Achievement } from '@/api/Api';

/**
 * Whether an achievement is part of the event: its stickers, the extras earned
 * during it, and the Grinch's. A secret one has lost its event slug, but keeps
 * its id ("christmas-2026-...") and its path ("christmas-2026:..."). The
 * Grinch's ("grinch-...") come from his judging, which only runs during it.
 */
export function isEventAchievement(a: Achievement, slug: string): boolean {
  return (
    a.eventSlug === slug ||
    a.id.startsWith(`${slug}-`) ||
    !!a.path?.startsWith(`${slug}:`) ||
    a.id.startsWith('grinch-')
  );
}

/** Something the Grinch is behind, which you can tell even while it's secret */
export const isGrinchAchievement = (a: Achievement): boolean =>
  a.id.includes('grinch');

/** One of the event's headline stickers: out in the open, with flair to wear (the Grinch's sit with his others) */
export const isMainSticker = (a: Achievement, slug: string): boolean =>
  a.eventSlug === slug && !!a.reward && !a.hidden && !isGrinchAchievement(a);

/** The event's achievements, split into its headline stickers and the rest */
export function splitEventAchievements(
  achievements: ReadonlyArray<Achievement>,
  slug: string,
): { main: Array<Achievement>; extras: Array<Achievement> } {
  const mine = achievements.filter((a) => isEventAchievement(a, slug));
  const main = mine.filter((a) => isMainSticker(a, slug));
  // Earned first, then the ones you can see coming, then the secrets
  const rank = (a: Achievement) => (a.achievedAt ? 0 : a.secret ? 2 : 1);
  const extras = mine
    .filter((a) => !isMainSticker(a, slug))
    .sort((a, b) => rank(a) - rank(b));
  return { main, extras };
}
