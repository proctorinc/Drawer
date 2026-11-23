import { useQuery } from '@tanstack/react-query';
import { useChristmas } from '../useChristmas';
import { fetchAPI } from '@/api/apiClient';

type TodaysPledges = { joined: Array<string>; refused: Array<string> };

/**
 * Whose side you and your friends took today, when the Grinch is judging and
 * asked. Under ['ai', 'judge', 'today'], so answering him refreshes it.
 */
function useTodaysPledges() {
  const christmas = useChristmas();
  return useQuery({
    enabled: !!christmas,
    queryKey: ['ai', 'judge', 'today', 'pledges'],
    queryFn: async (): Promise<TodaysPledges> => {
      const response = await fetchAPI('GET', '/ai/judge/today/pledges');
      if (!response.ok) throw new Error('Failed to load today’s pledges');
      return response.json();
    },
    staleTime: 60_000,
  });
}

/**
 * Whose side a player took today: 'joined' the Grinch, 'refused' him, or null
 * when they haven't answered (or he isn't asking today)
 */
export function useGrinchSide(userId?: string): 'joined' | 'refused' | null {
  const { data } = useTodaysPledges();
  if (!userId || !data) return null;
  if (data.joined.includes(userId)) return 'joined';
  if (data.refused.includes(userId)) return 'refused';
  return null;
}
