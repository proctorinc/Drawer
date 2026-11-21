import { useMyProfilePage } from './context/MyProfileContext';
import type { DecorationId } from '@/api/Api';
import { DECORATION_GROUPS } from '@/decorations/decorations';

/** Your flair: what you've unlocked, and what's still out there to earn */
export function useFlair() {
  const { achievementsData } = useMyProfilePage();

  const isUnlocked = (id: DecorationId) => !!achievementsData?.rewards.has(id);
  /** The sticker that unlocks it, by name */
  const stickerFor = (id: DecorationId) =>
    achievementsData?.achievements.find((a) => a.reward?.id === id)?.name;
  // Flair from an event that hasn't started (or that you missed) stays out of
  // sight: its sticker isn't listed, so there's nothing to earn it with
  const isAvailable = (id: DecorationId) => isUnlocked(id) || !!stickerFor(id);
  const groups = DECORATION_GROUPS.map((group) => ({
    ...group,
    ids: group.ids.filter(isAvailable),
  })).filter((group) => group.ids.length > 0);
  const available = groups.flatMap((group) => group.ids);

  return {
    isUnlocked,
    stickerFor,
    groups,
    unlocked: available.filter(isUnlocked).length,
    available: available.length,
    isLoading: !achievementsData,
  };
}
