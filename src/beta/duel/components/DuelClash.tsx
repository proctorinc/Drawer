import { useEffect } from 'react';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';
import '../duel.css';

/** Ink lines bursting out where the two faces smack together */
export const Burst: FC<{ className?: string }> = ({
  className = 'duel-burst size-44',
}) => (
  <svg
    viewBox="-50 -50 100 100"
    className={cn('absolute pointer-events-none', className)}
    aria-hidden="true"
  >
    {Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const inner = i % 2 ? 22 : 16;
      const outer = i % 2 ? 38 : 47;
      return (
        <line
          key={i}
          x1={Math.cos(angle) * inner}
          y1={Math.sin(angle) * inner}
          x2={Math.cos(angle) * outer}
          y2={Math.sin(angle) * outer}
          stroke="var(--color-ink)"
          strokeWidth={i % 2 ? 3 : 4.5}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

type Props = {
  left: User;
  right: User;
  onDone: () => void;
};

/**
 * The start of a duel: both players' faces fly in and collide, then it's
 * stamped as a co-op duel. Tap to skip; it gets out of the way by itself.
 */
export const DuelClash: FC<Props> = ({ left, right, onDone }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, 3400);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sketch duel: ${left.username} and ${right.username}`}
      onClick={onDone}
      className="paper fixed inset-0 z-[70] flex flex-col items-center justify-center gap-8 px-6 overflow-hidden cursor-pointer animate-in fade-in duration-200"
    >
      <div className="duel-shake relative flex items-center justify-center">
        <Burst />
        <div className="duel-face-left relative z-10 flex flex-col items-center gap-2">
          <UserProfileIcon user={left} size="2xl" showLevel={false} />
          <span className="font-accent font-bold text-2xl">
            {left.username}
          </span>
        </div>
        <div className="duel-face-right relative z-10 flex flex-col items-center gap-2">
          <UserProfileIcon user={right} size="2xl" showLevel={false} />
          <span className="font-accent font-bold text-2xl">
            {right.username}
          </span>
        </div>
      </div>

      <div className="duel-stamp px-5 py-2 bg-butter border-[3px] border-ink rounded-sketch">
        <span className="font-accent font-bold text-5xl leading-none">
          sketch duel!
        </span>
      </div>
      <p className="duel-later max-w-xs text-center text-xl text-pencil">
        draw for each other, score together
      </p>
      <span className="duel-later text-sm text-pencil">tap to start</span>
    </div>
  );
};

/**
 * The clash in miniature, for a header: both faces butting heads over a little ink
 * burst, beside the "sketch duel" stamp.
 */
export const ClashBadge: FC<{ left: User; right: User }> = ({
  left,
  right,
}) => (
  <div className="flex items-center gap-2" aria-label="sketch duel">
    <span className="relative flex items-center justify-center">
      <Burst className="size-[3.25rem]" />
      <span className="relative z-10 -mr-1 -rotate-12">
        <UserProfileIcon user={left} size="xs" showLevel={false} />
      </span>
      <span className="relative z-10 -ml-1 rotate-12">
        <UserProfileIcon user={right} size="xs" showLevel={false} />
      </span>
    </span>
    <span className="px-2.5 py-1 font-accent font-bold text-2xl leading-none bg-butter border-2 border-ink rounded-sketch -rotate-3 whitespace-nowrap">
      sketch duel!
    </span>
  </div>
);
