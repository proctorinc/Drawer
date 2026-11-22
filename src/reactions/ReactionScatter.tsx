import { ReactionSticker } from './ReactionSticker';
import type { CSSProperties, FC } from 'react';
import type { ReactionId } from '@/api/Api';
import { cn } from '@/utils';

type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * Where stickers land around the photo: a side, how far along it (%), and a
 * lean. Fixed, but ordered so they read as slapped on by hand rather than
 * laid out. Keeps clear of the score sticker (top-left corner), the push pin
 * (top middle), and the avatar and comment pill under the photo
 */
const SLOTS: Array<{ side: Side; at: number; tilt: number }> = [
  { side: 'right', at: 34, tilt: 9 },
  { side: 'left', at: 58, tilt: -8 },
  { side: 'bottom', at: 46, tilt: 5 },
  { side: 'top', at: 78, tilt: -11 },
  { side: 'right', at: 80, tilt: -4 },
  { side: 'left', at: 28, tilt: 12 },
  { side: 'top', at: 31, tilt: 7 },
  { side: 'right', at: 57, tilt: -12 },
  { side: 'bottom', at: 24, tilt: -7 },
  { side: 'left', at: 84, tilt: 3 },
  { side: 'bottom', at: 67, tilt: 10 },
  { side: 'right', at: 11, tilt: -5 },
];

/** How far out from the photo's edge a sticker's middle sits: the middle of the white border */
const BAND = 4;

const place = (side: Side, at: number): CSSProperties => {
  switch (side) {
    case 'top':
      return { left: `${at}%`, top: -BAND };
    case 'bottom':
      return { left: `${at}%`, top: `calc(100% + ${BAND}px)` };
    case 'left':
      return { left: -BAND, top: `${at}%` };
    case 'right':
      return { left: `calc(100% + ${BAND}px)`, top: `${at}%` };
  }
};

type Props = {
  /** Most-picked first */
  counts: Array<{ reactionId: ReactionId; count: number }>;
  /** Shifts which slot the most-picked lands in, so cards on a wall differ */
  seed?: number;
  size?: number;
  className?: string;
};

/**
 * A doodle's reactions stuck all around its photo's border. Sits over the
 * photo (absolutely positioned, ignoring clicks), most-picked first, with a
 * "+x" in the last spot when there are more than fit
 */
export const ReactionScatter: FC<Props> = ({
  counts,
  seed = 0,
  size = 22,
  className,
}) => {
  if (counts.length === 0) return null;
  const overflow = counts.length > SLOTS.length;
  const shown = overflow ? counts.slice(0, SLOTS.length - 1) : counts;
  const hidden = counts.length - shown.length;
  const slotAt = (i: number) => SLOTS[(i + seed * 5) % SLOTS.length];

  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 z-10 pointer-events-none', className)}
    >
      {shown.map(({ reactionId, count }, i) => {
        const { side, at, tilt } = slotAt(i);
        return (
          <span
            key={reactionId}
            className="absolute animate-pop"
            style={{
              ...place(side, at),
              // Sized outright: past the right edge there's no room to
              // shrink-wrap into, and the img would squash to nothing
              width: size,
              height: size,
              translate: '-50% -50%',
              rotate: `${tilt}deg`,
              animationDelay: `${200 + i * 60}ms`,
            }}
          >
            <ReactionSticker
              reactionId={reactionId}
              size={size}
              className="block max-w-none"
            />
            {count > 1 && (
              <span className="absolute -bottom-1 -right-2 px-[3px] whitespace-nowrap min-w-3.5 bg-white border border-ink rounded-full font-accent font-bold text-[10px] leading-[12px] text-center">
                ×{count}
              </span>
            )}
          </span>
        );
      })}
      {hidden > 0 &&
        (() => {
          const { side, at, tilt } = slotAt(SLOTS.length - 1);
          return (
            <span
              className="absolute px-1 whitespace-nowrap bg-white border border-ink rounded-full font-accent font-bold text-[11px] leading-[14px]"
              style={{
                ...place(side, at),
                translate: '-50% -50%',
                rotate: `${tilt}deg`,
              }}
            >
              +{hidden}
            </span>
          );
        })()}
    </div>
  );
};
