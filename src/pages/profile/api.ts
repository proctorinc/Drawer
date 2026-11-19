import { useQuery } from '@tanstack/react-query';
import type { Achievement } from '@/api/Api';
import type { ActivityCounts, Level } from '@/api/trophies';
import { fetchAPI } from '@/api/apiClient';

/** The part of someone's trophy cabinet shown on their book */
export interface PublicTrophies {
  level: Level;
  currentStreak: number;
  lifetime: ActivityCounts;
}

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetchAPI('GET', path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

export function useGetUserTrophies(userId: string) {
  return useQuery({
    queryKey: ['userTrophies', userId],
    queryFn: () => getJSON<PublicTrophies>(`/user/${userId}/trophies`),
  });
}

export function useGetUserAchievements(userId: string) {
  return useQuery({
    queryKey: ['userAchievements', userId],
    queryFn: () =>
      getJSON<{ achievements: Array<Achievement> }>(
        `/user/${userId}/achievements`,
      ),
    select: (data) => data.achievements,
  });
}
