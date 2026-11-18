import type { FriendSubmissionStatus } from '@/api/Api';

/** Your friends' drawing status for today, split by whether they've drawn */
export function rollCall(
  statuses: Array<FriendSubmissionStatus>,
  myId: string,
) {
  const friends = statuses.filter((status) => status.user.id !== myId);
  return {
    drawn: friends.filter((friend) => friend.hasSubmittedToday),
    stillDrawing: friends.filter((friend) => !friend.hasSubmittedToday),
  };
}
