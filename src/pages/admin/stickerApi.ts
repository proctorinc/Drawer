import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PromptSticker } from '@/stickers/stickers';
import { fetchAPI } from '@/api/apiClient';

/** The sticker one day's prompt hands out */
export type DaySticker = PromptSticker & { day: string };

const stickersKey = ['admin', 'stickers'];

async function ensureOk(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? response.statusText);
  }
}

export const useAdminStickers = () =>
  useQuery({
    queryKey: stickersKey,
    queryFn: async (): Promise<Array<DaySticker>> => {
      const response = await fetchAPI('GET', '/admin/stickers');
      await ensureOk(response);
      return (await response.json()).stickers;
    },
  });

/** Gives a day's prompt a sticker (null takes it away) */
export function useSetPromptSticker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      day,
      sticker,
    }: {
      day: string;
      sticker: PromptSticker | null;
    }) =>
      ensureOk(
        sticker
          ? await fetchAPI('PUT', `/admin/prompts/${day}/sticker`, {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sticker),
            })
          : await fetchAPI('DELETE', `/admin/prompts/${day}/sticker`),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stickersKey }),
  });
}
