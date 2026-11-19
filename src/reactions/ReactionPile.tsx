import { useLayoutEffect, useRef, useState } from 'react';
import { ReactionSticker } from './ReactionSticker';
import type { FC } from 'react';
import type { ReactionId } from '@/api/Api';
import { cn } from '@/utils';

// Each sticker leans its own way
const TILTS = ['-rotate-6', 'rotate-6', '-rotate-3', 'rotate-3'];
// Room after a sticker: a little, or enough to fit its ×N tag
const GAP = 3;
const TAG_GAP = 11;
// Room kept for the "+x" when not everything fits
const MORE_WIDTH = 16;

type Props = {
  /** Most-picked first */
  counts: Array<{ reactionId: ReactionId; count: number }>;
  size?: number;
  className?: string;
};

/**
 * A doodle's reactions as a row of stickers, as many as fit with a "+x" for
 * the rest. No totals: a sticker only gets a little ×N when more than one
 * person picked it
 */
export const ReactionPile: FC<Props> = ({ counts, size = 20, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const slot = (count: number) => size + (count > 1 ? TAG_GAP : GAP);
  const total = counts.reduce((sum, c) => sum + slot(c.count), 0);
  // Everything, or as many as leave room for the "+x"
  let shown = counts.length;
  if (width !== null && total > width) {
    // Always at least the most-picked one, however tight it gets
    shown = 1;
    let used = MORE_WIDTH + slot(counts[0].count);
    for (const c of counts.slice(1)) {
      if (used + slot(c.count) > width) break;
      used += slot(c.count);
      shown++;
    }
  }
  const hidden = counts.length - shown;

  return (
    <span ref={ref} className={cn('flex items-center min-w-0', className)}>
      {counts.slice(0, shown).map(({ reactionId, count }, i) => (
        <span
          key={reactionId}
          className="relative flex-none"
          style={{ marginRight: slot(count) - size }}
        >
          <ReactionSticker
            reactionId={reactionId}
            size={size}
            className={TILTS[i % TILTS.length]}
          />
          {count > 1 && (
            <span className="absolute -bottom-1 -right-2 px-[3px] min-w-3.5 bg-white border border-ink rounded-full font-accent font-bold text-[10px] leading-[12px] text-center">
              ×{count}
            </span>
          )}
        </span>
      ))}
      {hidden > 0 && (
        <span className="flex-none font-accent font-bold text-[13px] leading-none text-pencil">
          +{hidden}
        </span>
      )}
    </span>
  );
};
