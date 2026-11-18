import { useState } from 'react';
import { eventReactions, moreReactions, standardReactions } from './catalog';
import { ReactionSticker } from './ReactionSticker';
import type { FC } from 'react';
import type { ReactionId } from '@/api/Api';
import type { ReactionInfo } from './catalog';
import { cn } from '@/utils';
import { useChristmas } from '@/events/useChristmas';

type Props = {
  /** Reactions the viewer has already left, shown pressed */
  picked: Set<ReactionId>;
  onPick: (id: ReactionId) => void;
  className?: string;
};

/** A sticker sheet: the everyday reactions up top, with the whole library a tap away */
export const ReactionPicker: FC<Props> = ({ picked, onPick, className }) => {
  const [showMore, setShowMore] = useState(false);
  const christmas = useChristmas();
  const festive = eventReactions.filter((reaction) =>
    christmas?.reactions.includes(reaction.id),
  );

  const button = (reaction: ReactionInfo, size: number) => {
    const isPicked = picked.has(reaction.id);
    return (
      <button
        key={reaction.id}
        type="button"
        title={reaction.label}
        aria-label={reaction.label}
        aria-pressed={isPicked}
        onClick={() => onPick(reaction.id)}
        className={cn(
          'grid place-items-center p-1 border-[1.5px] border-transparent rounded-blob transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] hover:scale-125 hover:-rotate-6 active:scale-90',
          isPicked && 'border-ink',
        )}
        style={{ backgroundColor: isPicked ? reaction.tint : undefined }}
      >
        <ReactionSticker reactionId={reaction.id} size={size} />
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Pick a reaction"
      className={cn(
        'z-30 w-[min(20rem,calc(100vw-3rem))] p-2.5 bg-white border-2 border-ink rounded-sketch shadow-pencil animate-rise',
        className,
      )}
    >
      {festive.length > 0 && (
        <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b-[1.5px] border-dashed border-line">
          <span className="mr-auto font-cursive text-xl text-xmas-green">
            christmas stickers
          </span>
          {festive.map((reaction) => button(reaction, 34))}
        </div>
      )}
      <div className="flex justify-between">
        {standardReactions.map((reaction) => button(reaction, 34))}
      </div>
      {showMore ? (
        <>
          <hr className="my-2 border-t-[1.5px] border-dashed border-line" />
          <div className="grid grid-cols-7 gap-0.5 max-h-52 overflow-y-auto overscroll-contain">
            {moreReactions.map((reaction) => button(reaction, 28))}
          </div>
          <p className="mt-1 text-right text-xs text-pencil">
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
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full mt-2 py-1 font-cursive text-xl text-pencil border-t-[1.5px] border-dashed border-line hover:text-ink transition-colors"
        >
          more stickers…
        </button>
      )}
    </div>
  );
};
