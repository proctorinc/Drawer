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
  /** Monday to Sunday, YYYY-MM-DD */
  week: {
    start: string;
    end: string;
    /** ISO timestamp of when next week's quests begin */
    resetsAt: string;
  };
  quests: Array<Quest>;
  /** You and your friends, by XP earned this week */
  leaderboard: Array<LeaderboardEntry>;
  xpRules: Array<{ action: string; xp: number }>;
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
