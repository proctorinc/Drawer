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

export function rollCallTagline(
  drawn: number,
  total: number,
  iDrew: boolean,
): string {
  const waiting = total - drawn;
  if (waiting === 0) return 'full house! everyone drew today';
  if (drawn === 0) {
    return iDrew
      ? "you're first! poke your friends to join in"
      : 'blank pages all round. go first and set the bar';
  }
  return iDrew
    ? `waiting on ${waiting} slowpoke${waiting === 1 ? '' : 's'}. give them a poke!`
    : `${drawn} already drew. don't let them have all the fun`;
}
