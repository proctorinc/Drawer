import { useCallback, useEffect, useRef } from 'react';
import { wereTipsSeen } from './seen';
import type { FC } from 'react';
import type { Pencil } from '@/drawing/pencils';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { InfoIcon } from '@/components/icons';
import { cn } from '@/utils';

type Props = {
  pencils: Array<Pencil>;
  /** The day's background color, if it has one */
  paper?: string;
  className?: string;
};

/**
 * Opens the drawing tips. They also open on their own the first time you sit
 * down to draw; after that, only from here.
 */
export const DrawingTipsButton: FC<Props> = ({ pencils, paper, className }) => {
  const { enqueue } = useAnimationQueue();
  const show = useCallback(
    (id: string) =>
      void enqueue({
        id,
        kind: 'drawingTips',
        payload: { pencils, paper: paper ?? '#ffffff' },
      }),
    [enqueue, pencils, paper],
  );

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || wereTipsSeen()) return;
    asked.current = true;
    show('drawing-tips:first');
  }, [show]);

  return (
    <button
      type="button"
      aria-label="Drawing tips"
      title="Drawing tips"
      // Its own id each time, so a replay never merges with one already queued
      onClick={() => show(`drawing-tips:${Date.now()}`)}
      className={cn(
        'flex items-center justify-center size-8 text-pencil rounded-full cursor-pointer hover:text-ink hover:-rotate-12 transition-[rotate,color] duration-300 active:scale-90',
        className,
      )}
    >
      <InfoIcon size={20} />
    </button>
  );
};
