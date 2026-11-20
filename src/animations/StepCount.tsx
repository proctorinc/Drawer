import type { FC } from 'react';
import type { StageStep } from './types';
import { cn } from '@/utils';

// More than this and the dots would crowd; the words alone say enough
const MAX_DOTS = 8;

/**
 * "2 of 5" for one of several things earned at once, so you know how many
 * you'll click through. Renders nothing for a lone one.
 */
export const StepCount: FC<{ step?: StageStep; className?: string }> = ({
  step,
  className,
}) => {
  if (!step) return null;
  const { index, total } = step;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 bg-white border-[1.5px] border-ink rounded-full text-sm leading-none text-ink',
        className,
      )}
    >
      {total <= MAX_DOTS && (
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-2 rounded-full border-[1.5px] border-ink',
                i < index ? 'bg-ink' : 'bg-white',
                i === index - 1 && 'scale-125',
              )}
            />
          ))}
        </span>
      )}
      <span className="font-bold tabular-nums">
        {index} of {total}
      </span>
    </span>
  );
};

/** Whether more of the set come after this one */
export const hasNext = (step?: StageStep) => !!step && step.index < step.total;
