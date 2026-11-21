import type { DecorationId } from '@/api/Api';

/**
 * A nudge toward a part of the app you haven't used yet. Things that just
 * happened to you (stickers, friend requests) belong to the activity bell, not here.
 */
export type Tip =
  | { kind: 'notifications'; id: string }
  | { kind: 'flair'; id: string; decoration: DecorationId }
  | { kind: 'face'; id: string }
  | { kind: 'friends'; id: string };

type TipInput = {
  /** This device could get pushes but isn't, and you never turned them off yourself */
  canTurnOnNotifications: boolean;
  unlockedDecorations: Array<DecorationId>;
  wearing: DecorationId | '';
  faceUnlocked: boolean;
  hasDrawnFace: boolean;
  /** With none, the roll call already says how to add some */
  friendCount: number;
  /** Ids of tips already tapped or dismissed, which never come back */
  seen: Array<string>;
};

const MAX_TIPS = 3;

/** The few most useful tips right now, most useful first */
export function pickTips(input: TipInput): Array<Tip> {
  const firstFlair = input.unlockedDecorations.at(0);

  const tips: Array<Tip | false> = [
    input.canTurnOnNotifications && {
      kind: 'notifications',
      id: 'notifications',
    },
    // Only until you've worn something; after that you know where flair lives
    !!firstFlair &&
      input.wearing === '' && {
        kind: 'flair',
        id: 'flair',
        decoration: firstFlair,
      },
    input.faceUnlocked && !input.hasDrawnFace && { kind: 'face', id: 'face' },
    input.friendCount > 0 &&
      input.friendCount < 3 && { kind: 'friends', id: 'friends' },
  ];

  return tips
    .filter((tip): tip is Tip => !!tip && !input.seen.includes(tip.id))
    .slice(0, MAX_TIPS);
}
