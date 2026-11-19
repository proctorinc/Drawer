import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/api/apiClient';

// The server scores at most this many users per request
const MAX_PER_REQUEST = 100;

type Waiter = {
  resolve: (level: number) => void;
  reject: (error: unknown) => void;
};

// Avatars ask one at a time; ids asked for in the same moment share a request
const waiting = new Map<string, Array<Waiter>>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

async function flush() {
  flushTimer = undefined;
  const batch = new Map(waiting);
  waiting.clear();

  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
    const chunk = ids.slice(i, i + MAX_PER_REQUEST);
    try {
      const params = new URLSearchParams({ ids: chunk.join(',') });
      const response = await fetchAPI('GET', `/user/levels?${params}`);
      if (!response.ok) throw new Error('Failed to load levels');
      const { levels } = (await response.json()) as {
        levels: Record<string, number>;
      };
      for (const id of chunk) {
        for (const waiter of batch.get(id) ?? [])
          waiter.resolve(levels[id] ?? 1);
      }
    } catch (error) {
      for (const id of chunk) {
        for (const waiter of batch.get(id) ?? []) waiter.reject(error);
      }
    }
  }
}

function loadLevel(userId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const waiters = waiting.get(userId) ?? [];
    waiters.push({ resolve, reject });
    waiting.set(userId, waiters);
    flushTimer ??= setTimeout(flush, 10);
  });
}

/** Someone's level, fetched alongside every other avatar on screen */
export function useUserLevel(userId: string | undefined) {
  return useQuery({
    queryKey: ['userLevel', userId],
    queryFn: () => loadLevel(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
