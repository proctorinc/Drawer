import { useStickers } from './StickerContext';
import { STICKERS, bubbleMaxChars } from './stickers';
import type { FC } from 'react';
import { ToolButton } from '@/drawing/Toolbar';
import {
  BubbleIcon,
  CheckIcon,
  FlipIcon,
  GooglyEyesIcon,
  TrashIcon,
} from '@/components/icons';
import { cn } from '@/utils';

const StickerIcon: FC<{ kind: string }> = ({ kind }) =>
  kind === 'bubble' ? <BubbleIcon /> : <GooglyEyesIcon />;

/** Beside the eraser: sticks the prompt's sticker on, or picks it back up */
export const AddStickerButton: FC<{ compact?: boolean }> = ({ compact }) => {
  const { sticker, placed, add, select } = useStickers();
  if (!sticker) return null;
  const { label } = STICKERS[sticker.kind];

  return (
    <ToolButton
      label={placed ? `Edit the ${label}` : `Add the ${label}`}
      compact={compact}
      onClick={placed ? select : add}
    >
      <StickerIcon kind={sticker.kind} />
    </ToolButton>
  );
};

/** In place of the pencils while the sticker's picked up: what it says, which way it faces */
export const StickerControls: FC<{ compact?: boolean; className?: string }> = ({
  compact,
  className,
}) => {
  const { sticker, placed, update, remove, deselect, jiggle } = useStickers();
  if (!sticker || !placed) return null;
  const maxChars = bubbleMaxChars(sticker);

  return (
    <div className={cn('flex items-center w-full gap-2', className)}>
      {placed.kind === 'bubble' ? (
        <label className="relative flex-1 min-w-28">
          <span className="sr-only">What the bubble says</span>
          <input
            type="text"
            value={placed.text}
            maxLength={maxChars}
            placeholder="say something…"
            enterKeyHint="done"
            // Straight to typing when it's just been stuck on
            autoFocus={!placed.text}
            onChange={(event) => update({ text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') deselect();
            }}
            className={cn(
              // 16px or more, so iOS doesn't zoom the page to type
              'w-full pl-3 pr-12 font-accent text-xl bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm outline-none focus:bg-butter/30',
              compact ? 'h-10' : 'h-[46px]',
            )}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-pencil tabular-nums pointer-events-none">
            {maxChars - placed.text.length}
          </span>
        </label>
      ) : (
        <p className="flex-1 min-w-0 text-pencil leading-tight">
          drag them about, or tap them for a wobble
        </p>
      )}
      {placed.kind === 'bubble' ? (
        <ToolButton
          label="Flip the bubble"
          compact={compact}
          isActive={placed.flipped}
          onClick={() => update({ flipped: !placed.flipped })}
        >
          <FlipIcon />
        </ToolButton>
      ) : (
        <ToolButton label="Wobble them" compact={compact} onClick={jiggle}>
          <GooglyEyesIcon />
        </ToolButton>
      )}
      <ToolButton label="Take it off" compact={compact} onClick={remove}>
        <TrashIcon />
      </ToolButton>
      <ToolButton label="Done" compact={compact} onClick={deselect}>
        <CheckIcon />
      </ToolButton>
    </div>
  );
};
