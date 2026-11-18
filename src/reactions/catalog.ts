// Shared with the server, which only accepts reaction ids listed here
import catalog from '../../server/internal/reactions/reactions.json';
import type { ReactionId } from '@/api/Api';

export type ReactionInfo = {
  id: ReactionId;
  /** Shown on hover and read by screen readers */
  label: string;
  /** Finishes "alice ___ your goalie" in the activity feed */
  verb: string;
  /** Pill background once someone has picked it */
  tint: string;
  /** Offered up front in the picker; the rest sit behind "more" */
  standard?: boolean;
  /** Only offered while a live event lists it (the server enforces this too) */
  event?: boolean;
  /** Art that isn't an OpenMoji png in /reactions */
  image?: string;
};

export const reactions: Array<ReactionInfo> = catalog;

export const standardReactions = reactions.filter((r) => r.standard);
export const moreReactions = reactions.filter((r) => !r.standard && !r.event);
export const eventReactions = reactions.filter((r) => r.event);

const byId = new Map(reactions.map((r) => [r.id, r]));

/** Falls back to a plain heart if an old or unknown id turns up */
export function getReaction(id: ReactionId): ReactionInfo {
  return byId.get(id) ?? byId.get('heart')!;
}

export function reactionImageUrl(id: ReactionId) {
  const reaction = getReaction(id);
  return reaction.image ?? `/reactions/${reaction.id}.png`;
}
