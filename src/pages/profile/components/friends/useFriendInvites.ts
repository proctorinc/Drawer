import { useQueryClient } from '@tanstack/react-query';
import {
  queryKeys,
  useAcceptInvitation,
  useDenyInvitation,
  useGetInvitations,
} from '@/api/Api';

/**
 * Refetches everything a friendship touches: both books, the invites, and
 * today's page, which shows friends' doodles
 */
export function useRefreshFriendship() {
  const queryClient = useQueryClient();

  return (userId: string) =>
    [
      queryKeys.invitations,
      queryKeys.myProfile,
      queryKeys.userProfile(userId),
      queryKeys.daily,
      queryKeys.activityFeed,
    ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}

/** Friend invites both ways, plus accept/deny that refresh the friend list */
export function useFriendInvites() {
  const { data } = useGetInvitations();
  const acceptInvitation = useAcceptInvitation();
  const denyInvitation = useDenyInvitation();
  const refreshFriendship = useRefreshFriendship();

  const onSuccess = (_: unknown, userId: string) => refreshFriendship(userId);

  return {
    /** Invites other people sent me */
    incoming: data?.invitee ?? [],
    /** Invites I sent that are still waiting */
    outgoing: data?.invited ?? [],
    accept: (userId: string) => acceptInvitation.mutate(userId, { onSuccess }),
    /** Turns down an incoming invite, or takes back an outgoing one */
    deny: (userId: string) => denyInvitation.mutate(userId, { onSuccess }),
    isPending: acceptInvitation.isPending || denyInvitation.isPending,
    error: acceptInvitation.error ?? denyInvitation.error,
  };
}
