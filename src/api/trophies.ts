import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from './apiClient';
import type { User } from './Api';

export interface ActivityCounts {
  drawings: number;
  reactionsGiven: number;
  drawingsReacted: number;
  commentsWritten: number;
  reactionsReceived: number;
  cryLaughsReceived: number;
  achievements: number;
}

export interface Level {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  goal: number;
  /** Bonus XP for finishing it this week */
  xp: number;
}

/** Monday to Sunday, YYYY-MM-DD */
export interface Week {
  start: string;
  end: string;
  /** ISO timestamp of when next week's quests begin */
  resetsAt: string;
}

export interface LeaderboardEntry {
  user: User;
  xp: number;
  drawings: number;
}

export interface TrophiesResponse {
  level: Level;
  currentStreak: number;
  lifetime: ActivityCounts;
  week: Week;
  /** Empty while an event is live: its page has the week's quests instead */
  quests: Array<Quest>;
  /** The live event whose page has this week's quests, if any */
  questsEvent: { slug: string; name: string; theme: string } | null;
  /** You and your friends, by all-time XP */
  leaderboard: Array<LeaderboardEntry>;
  xpRules: Array<{ action: string; xp: number; maxXp?: number }>;
}

async function getTrophies(): Promise<TrophiesResponse> {
  const response = await fetchAPI('GET', '/trophies');
  if (!response.ok) {
    throw new Error('Failed to load trophies');
  }
  return response.json();
}

export function useGetTrophies() {
  return useQuery({ queryKey: ['trophies'], queryFn: getTrophies });
}
