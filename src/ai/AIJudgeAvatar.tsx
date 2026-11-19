import { useState } from 'react';
import { AIAvatarDecoration } from './decorations';
import type { FC } from 'react';
import type { AIJudge } from '@/api/Api';
import { cn } from '@/utils';

const SIZES = {
  xs: { box: 'size-5', border: 'border-[1.5px]', badge: '' },
  sm: { box: 'size-9', border: 'border-2', badge: 'text-[9px] px-1' },
  lg: { box: 'size-12', border: 'border-2', badge: 'text-[10px] px-1.5' },
  xl: { box: 'size-20', border: 'border-[2.5px]', badge: 'text-xs px-2' },
} as const;

type Props = {
  judge: Pick<AIJudge, 'name' | 'avatarUrl' | 'decoration'>;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * An AI judge's face. Like a player's avatar, but it never links to a profile,
 * wears an AI-only decoration, and carries an "AI" tag where a player's level
 * badge would be, so nobody mistakes it for a friend.
 */
export const AIJudgeAvatar: FC<Props> = ({ judge, size = 'sm', className }) => {
  const [broken, setBroken] = useState(false);
  const s = SIZES[size];

  return (
    <span
      className={cn('relative inline-flex flex-none', s.box, className)}
      title={`${judge.name} (AI)`}
    >
      <span
        className={cn(
          'grid place-items-center size-full overflow-hidden rounded-full border-ink bg-sky font-accent font-bold',
          s.border,
        )}
      >
        {judge.avatarUrl && !broken ? (
          <img
            src={judge.avatarUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span aria-hidden="true">{judge.name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      {judge.decoration && (
        <span className="absolute inset-0 z-20 pointer-events-none">
          <AIAvatarDecoration id={judge.decoration} />
        </span>
      )}
      {/* Too small to read at xs; whatever sits next to it says it's an AI */}
      {size !== 'xs' && (
        <span
          className={cn(
            'absolute z-30 -right-1.5 -bottom-1 rounded-full border-[1.5px] border-ink bg-butter font-bold leading-tight tracking-wide',
            s.badge,
          )}
        >
          AI
        </span>
      )}
    </span>
  );
};
