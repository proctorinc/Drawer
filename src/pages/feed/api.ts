import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/api/apiClient';
import { queryKeys } from '@/api/Api';

async function pokeFriend(userId: string): Promise<void> {
  const response = await fetchAPI('POST', `/user/${userId}/poke`);
  // 409: already poked today, or they've drawn since. Either way, job done.
  if (!response.ok && response.status !== 409) {
    throw new Error('Failed to poke');
  }
}

/** Sends a friend who hasn't drawn yet a push nudge, once per day */
export function usePokeFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pokeFriend,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed }),
  });
}
