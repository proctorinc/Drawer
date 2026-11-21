import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchAPI } from './apiClient';
import type { PencilSound } from '@/drawing/feedback';
import { setPencilSound } from '@/drawing/feedback';

/** App-wide choices admins make for everyone */
export interface AppSettings {
  pencilSound: PencilSound;
}

export const appSettingsKey = ['appSettings'] as const;

export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    queryFn: async (): Promise<AppSettings> => {
      const response = await fetchAPI('GET', '/settings');
      if (!response.ok) {
        throw new Error(`Error fetching settings: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: Partial<AppSettings>) => {
      const response = await fetchAPI('PUT', '/admin/settings', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!response.ok) {
        throw new Error(`Error saving settings: ${response.statusText}`);
      }
      return (await response.json()) as AppSettings;
    },
    onSuccess: (settings) => queryClient.setQueryData(appSettingsKey, settings),
  });
}

/** Hands the pencil sound admins picked to the canvas's sound engine */
export function usePencilSoundSync() {
  const { data } = useAppSettings();
  const sound = data?.pencilSound;
  useEffect(() => {
    if (sound) setPencilSound(sound);
  }, [sound]);
}
