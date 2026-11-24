import type { FC, ReactNode } from 'react';
import type { DuelHost } from '../api';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { useTypewriter } from '@/ai/AIDialogue';
import { cn } from '@/utils';

type Props = {
  host: DuelHost;
  /** What the host says, typed out RPG style */
  line: string;
  /** Shown under the line once it's finished typing, e.g. the button for the next step */
  children?: ReactNode;
  /** One slim row, face beside the bubble, for tight phone layouts */
  compact?: boolean;
  className?: string;
};

/**
 * The duel's host talking you through it, like a quest-giver: their face bobs
 * while the line types out in a speech bubble. Tap the bubble to skip ahead.
 */
export const HostSays: FC<Props> = ({
  host,
  line,
  children,
  compact = false,
  className,
}) => {
  const { shown, done, talking, finish } = useTypewriter(line, host.name);

  if (compact) {
    return (
      <div className={cn('flex items-end gap-1.5 w-full', className)}>
        <span
          className={cn(
            'inline-flex flex-none origin-bottom',
            talking && 'animate-talk',
          )}
        >
          <AIJudgeAvatar judge={host} size="lg" />
        </span>
        <div
          className="relative flex-1 min-w-0 px-3 py-1.5 bg-white border-2 border-ink rounded-sketch cursor-pointer"
          onClick={finish}
        >
          <span
            aria-hidden="true"
            className="absolute bottom-2.5 -left-[9px] size-4 rotate-45 bg-white border-l-2 border-b-2 border-ink"
          />
          <p className="sr-only" aria-live="polite">
            {done ? line : ''}
          </p>
          <div aria-hidden="true" className="grid text-base leading-snug">
            <span className="invisible [grid-area:1/1]">{line}</span>
            <span className="[grid-area:1/1]">{shown}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col w-full', className)}>
      <div className="flex items-end gap-2 pl-1">
        <span
          className={cn('inline-flex origin-bottom', talking && 'animate-talk')}
        >
          <AIJudgeAvatar judge={host} size="lg" />
        </span>
        <b className="mb-1 px-2.5 py-0.5 font-accent font-bold text-xl leading-none bg-white border-2 border-ink rounded-sketch-alt -rotate-1">
          {host.name}
        </b>
      </div>
      <div
        className="relative mt-2.5 bg-white border-2 border-ink rounded-sketch px-4 pt-3 pb-3 cursor-pointer"
        onClick={finish}
      >
        <span
          aria-hidden="true"
          className="absolute -top-[9px] left-6 size-4 rotate-45 bg-white border-l-2 border-t-2 border-ink"
        />
        <p className="sr-only" aria-live="polite">
          {done ? line : ''}
        </p>
        {/* The whole line sits invisibly underneath, so the bubble doesn't grow as it types */}
        <div aria-hidden="true" className="grid text-lg leading-snug">
          <span className="invisible [grid-area:1/1]">{line}</span>
          <span className="[grid-area:1/1]">
            {shown}
            {!done && (
              <span className="inline-block w-2 ml-0.5 animate-pulse">▍</span>
            )}
          </span>
        </div>
        {children && (
          <div
            className={cn(
              'mt-3 transition-opacity duration-300',
              done ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
