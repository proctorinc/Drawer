import { useState } from 'react';
import { AIAvatarDecoration } from './decorations';
import type { FC } from 'react';
import type { AIJudge } from '@/api/Api';
import { cn } from '@/utils';

const SIZES = {
  xs: { box: 'size-5', border: 'border-[1.5px]' },
  sm: { box: 'size-9', border: 'border-2' },
  lg: { box: 'size-12', border: 'border-2' },
  xl: { box: 'size-20', border: 'border-[2.5px]' },
} as const;

type Props = {
  judge: Pick<AIJudge, 'name' | 'avatarUrl' | 'decoration'>;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * A judge's face. Like a player's avatar, but it never links to a profile and
 * wears a judge-only decoration, so nobody mistakes it for a friend.
 */
export const AIJudgeAvatar: FC<Props> = ({ judge, size = 'sm', className }) => {
  const [broken, setBroken] = useState(false);
  const s = SIZES[size];

  return (
    <span
      className={cn('relative inline-flex flex-none', s.box, className)}
      title={judge.name}
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
    </span>
  );
};
