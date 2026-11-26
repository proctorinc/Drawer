import { useQuery } from '@tanstack/react-query';
import { defaultAvatarFor, parseFace } from './sketchFace';
import type { AvatarParts } from './sketchFace';
import type { User } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';

export const avatarFacesKey = ['avatar-faces'];

/** The sketch faces admins picked, by user id. Few and rarely changed */
export const useAvatarFaces = () =>
  useQuery({
    queryKey: avatarFacesKey,
    queryFn: async (): Promise<Record<string, string>> => {
      const response = await fetchAPI('GET', '/user/avatar-faces');
      if (!response.ok) throw new Error('Failed to load avatar faces');
      return (await response.json()).faces;
    },
    staleTime: 5 * 60 * 1000,
  });

/** The sketch face a user wears: the one an admin picked, else their own */
export const useSketchFace = (
  user: Pick<User, 'id' | 'username'>,
): AvatarParts => {
  const { data: faces } = useAvatarFaces();
  const own = defaultAvatarFor(user);
  const picked = faces?.[user.id];
  return (picked && parseFace(picked, own)) || own;
};
