import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/api/apiClient';

/** Every AI judge's name, to tell a judge's @handle from a player's */
export function useJudgeNames() {
  return useQuery({
    queryKey: ['ai', 'judges', 'names'],
    queryFn: async (): Promise<Array<string>> => {
      const response = await fetchAPI('GET', '/ai/judges/names');
      if (!response.ok) throw new Error("Failed to load the judges' names");
      return (await response.json()).names;
    },
    // Judges are rarely added; nice to have, so never worth a retry storm
    staleTime: 60 * 60_000,
    retry: false,
  });
}
