import { eventReactions, getReaction, reactions } from './catalog';
import { ReactionSticker } from './ReactionSticker';
import type { FC } from 'react';
import type { Reaction, ReactionCount, ReactionId } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { useChristmas } from '@/events/useChristmas';
import Sheet from '@/pages/profile/components/Sheet';
import { cn } from '@/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Everyone's reactions, to mark yours and say who picked what */
  reactions: Array<Reaction>;
  /** Most-picked first */
  counts: Array<ReactionCount>;
  /** Adds or takes back your reaction */
  onToggle: (id: ReactionId) => void;
  title?: string;
};

/**
 * Every sticker you can react with, in a drawer. The ones already used sit
 * at the top with how many picked each; everything else is laid out below,
 * always open. Picking one toggles yours and closes the drawer.
 */
export const ReactionDrawer: FC<Props> = ({
  open,
  onClose,
  reactions: given,
  counts,
  onToggle,
  title = 'react',
}) => {
  const user = useUser();
  const christmas = useChristmas();

  const mine = new Set(
    given.filter((r) => r.user.id === user.id).map((r) => r.reactionId),
  );
  const used = new Set(counts.map((c) => c.reactionId));
  // Event stickers only while their event is on; the server checks this too
  const available = reactions.filter(
    (r) =>
      !r.event ||
      (eventReactions.includes(r) && christmas?.reactions.includes(r.id)),
  );
  const others = available.filter((r) => !used.has(r.id));

  function pick(id: ReactionId) {
    onToggle(id);
    onClose();
  }

  /** "Love it: you, alice" */
  function whoPicked(id: ReactionId) {
    const names = given
      .filter((r) => r.reactionId === id)
      .map((r) => (r.user.id === user.id ? 'you' : r.user.username));
    return `${getReaction(id).label}: ${names.join(', ')}`;
  }

  return (
    <Sheet title={title} open={open} onClose={onClose}>
      {counts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-cursive text-xl text-pencil">already here</h3>
          <div className="flex flex-wrap gap-2">
            {counts.map(({ reactionId, count }) => {
              const isMine = mine.has(reactionId);
              const { tint, label } = getReaction(reactionId);
              return (
                <button
                  key={reactionId}
                  type="button"
                  title={whoPicked(reactionId)}
                  aria-label={`${label}, ${count}${isMine ? ', including you' : ''}`}
                  aria-pressed={isMine}
                  onClick={() => pick(reactionId)}
                  className={cn(
                    'flex items-center gap-1 h-12 pl-2 pr-3 border-[1.5px] border-ink rounded-[16px_12px_17px_11px/13px_17px_12px_16px] font-accent font-bold text-lg cursor-pointer transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-105 active:scale-90',
                    isMine && 'border-2',
                    count <= 1 && 'pr-2',
                  )}
                  style={{
                    // Yours in full color, everyone else's washed out
                    backgroundColor: isMine
                      ? tint
                      : `color-mix(in srgb, ${tint} 40%, white)`,
                  }}
                >
                  <ReactionSticker reactionId={reactionId} size={32} />
                  {count > 1 && `×${count}`}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-cursive text-xl text-pencil">
          {counts.length > 0 ? 'more stickers' : 'pick a sticker'}
        </h3>
        <div className="grid grid-cols-6 gap-1">
          {others.map((reaction) => (
            <button
              key={reaction.id}
              type="button"
              title={reaction.label}
              aria-label={reaction.label}
              onClick={() => pick(reaction.id)}
              className="grid place-items-center aspect-square rounded-blob cursor-pointer transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] hover:scale-125 hover:-rotate-6 active:scale-90"
            >
              <ReactionSticker reactionId={reaction.id} size={36} />
            </button>
          ))}
        </div>
        <p className="text-right text-xs text-pencil">
          stickers by{' '}
          <a
            href="https://openmoji.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            OpenMoji
          </a>{' '}
          (CC BY-SA 4.0)
        </p>
      </section>
    </Sheet>
  );
};
