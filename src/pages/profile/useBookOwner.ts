import { useParams } from '@tanstack/react-router';
import { useGetMyProfile, useGetUserProfile } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

/** Link props for one of a book's full lists; 'me' is your own */
export const bookPage = (userId: string, page: 'drawings' | 'stickers') =>
  userId === 'me'
    ? ({ to: `/draw/profile/me/${page}` } as const)
    : ({ to: `/draw/profile/$userId/${page}`, params: { userId } } as const);

/**
 * Whose book a /draw/profile/$userId/... page is about. /me/... (or your own
 * id) is you, from your own cached profile; anyone else is fetched.
 */
export function useBookOwner() {
  const me = useUser();
  const { userId } = useParams({ strict: false });
  const isMe = !userId || userId === 'me' || userId === me.id;
  const mine = useGetMyProfile();
  const theirs = useGetUserProfile(isMe ? '' : userId);
  const query = isMe ? mine : theirs;

  return {
    isMe,
    /** Your id, or theirs; never 'me' */
    userId: isMe ? me.id : userId,
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
