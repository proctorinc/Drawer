import type { Achievement, DecorationId, User } from '@/api/Api';

/** A nudge toward something on the app you haven't tried yet */
export type Tip =
  | { kind: 'invite'; id: string; from: User }
  | { kind: 'sticker'; id: string; sticker: Achievement }
  | { kind: 'decoration'; id: string; decoration: DecorationId }
  | { kind: 'face'; id: string }
  | { kind: 'event'; id: string; slug: string; name: string }
  | { kind: 'friends'; id: string };

type TipInput = {
  incomingInvites: Array<User>;
  achievements: Array<Achievement>;
  unlockedDecorations: Array<DecorationId>;
  wearing: DecorationId | '';
  faceUnlocked: boolean;
  hasDrawnFace: boolean;
  event: { slug: string; name: string } | null;
  /** With none, the roll call already says how to add some */
  friendCount: number;
  /** Ids of tips already tapped or dismissed */
  seen: Array<string>;
  now: Date;
};

const MAX_TIPS = 3;

const achievedTime = (a: Achievement) =>
  a.achievedAt ? new Date(a.achievedAt).getTime() : 0;
const NEW_STICKER_DAYS = 3;

/** The few most useful tips right now, most pressing first */
export function pickTips(input: TipInput): Array<Tip> {
  const cutoff = input.now.getTime() - NEW_STICKER_DAYS * 86_400_000;

  const tips: Array<Tip> = [
    // Someone's waiting on you, so these come first
    ...input.incomingInvites.map(
      (from): Tip => ({ kind: 'invite', id: `invite:${from.id}`, from }),
    ),
    ...input.achievements
      .filter((a) => achievedTime(a) > cutoff)
      .sort((a, b) => achievedTime(b) - achievedTime(a))
      .map(
        (sticker): Tip => ({
          kind: 'sticker',
          id: `sticker:${sticker.id}`,
          sticker,
        }),
      ),
    ...input.unlockedDecorations
      .filter((decoration) => decoration !== input.wearing)
      .map(
        (decoration): Tip => ({
          kind: 'decoration',
          id: `decoration:${decoration}`,
          decoration,
        }),
      ),
    ...(input.faceUnlocked && !input.hasDrawnFace
      ? [{ kind: 'face', id: 'face' } as const]
      : []),
    ...(input.event
      ? [
          {
            kind: 'event',
            id: `event:${input.event.slug}`,
            ...input.event,
          } as const,
        ]
      : []),
    ...(input.friendCount > 0 && input.friendCount < 3
      ? [{ kind: 'friends', id: 'friends' } as const]
      : []),
  ];

  // One of each kind keeps the row varied, except invites: each is someone waiting
  const shownKinds = new Set<Tip['kind']>();
  return tips
    .filter((tip) => {
      if (input.seen.includes(tip.id)) return false;
      if (tip.kind === 'invite') return true;
      if (shownKinds.has(tip.kind)) return false;
      shownKinds.add(tip.kind);
      return true;
    })
    .slice(0, MAX_TIPS);
}
