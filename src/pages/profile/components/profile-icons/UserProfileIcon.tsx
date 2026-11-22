import { useNavigate } from '@tanstack/react-router';
import { cva } from 'class-variance-authority';
import { CustomProfileIcon } from './CustomProfileIcon';
import { BasicProfileIcon } from './BasicProfileIcon';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import { SantaHat } from '@/events/christmas/Decorations';
import { AvatarDecoration } from '@/decorations/decorations';
import { useChristmas } from '@/events/useChristmas';
import { LevelBadge } from '@/levels/LevelBadge';
import { useUserLevel } from '@/levels/useUserLevel';

// Level badge diameter for each avatar size
const BADGE_SIZES = { xs: 12, sm: 17, lg: 21, xl: 30, '2xl': 44 } as const;

export const userProfileIconVariants = cva(
  'cursor-pointer select-none rounded-full border-ink flex items-center justify-center hover:scale-110 hover:-rotate-6 transition-[scale,rotate] duration-300 ease-[var(--ease-spring)]',
  {
    variants: {
      size: {
        xs: 'w-6 h-6 text-[11px] border-[1.5px]',
        sm: 'w-9 h-9 text-sm border-2',
        lg: 'w-12 h-12 text-lg border-2',
        xl: 'w-20 h-20 text-3xl border-[2.5px]',
        '2xl': 'w-32 h-32 text-6xl border-[3px]',
      },
    },
    defaultVariants: {
      size: 'lg',
    },
  },
);

type Props = {
  user?: User;
  className?: string;
  onClick?: () => void;
  /** Off where a badge would get in the way, like decoration previews */
  showLevel?: boolean;
} & VariantProps<typeof userProfileIconVariants>;

export const UserProfileIcon: FC<Props> = ({
  user,
  className,
  size,
  onClick,
  showLevel = true,
}) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const christmas = useChristmas();
  const { data: level } = useUserLevel(showLevel ? user?.id : undefined);

  if (!user) {
    return (
      <div
        className={cn(
          userProfileIconVariants({ size }),
          'animate-pulse bg-primary',
          className,
        )}
      ></div>
    );
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (user.id === currentUser.id) {
      navigate({ to: '/draw/profile/me' });
    } else {
      navigate({ to: `/draw/profile/${user.id}` });
    }
  };

  // A worn decoration replaces the red hat everyone gets during Christmas
  let decoration = null;
  if (user.decoration) decoration = <AvatarDecoration id={user.decoration} />;
  else if (christmas) decoration = <SantaHat />;

  const badgeSize = BADGE_SIZES[size ?? 'lg'];
  const badge =
    showLevel && level !== undefined ? (
      <LevelBadge
        level={level}
        size={badgeSize}
        className="absolute z-30"
        style={{ right: -badgeSize * 0.22, bottom: -badgeSize * 0.22 }}
      />
    ) : null;
  const wrapped = !!decoration || !!badge;

  // When wrapped, the wrapper takes the caller's classes (position, ring,
  // tilt) so the decoration and badge move and turn with the avatar
  const iconClassName = wrapped ? undefined : className;
  const icon =
    user.avatarType === 'custom' && user.avatarUrl !== '' ? (
      <CustomProfileIcon
        size={size}
        onClick={handleClick}
        user={user}
        className={iconClassName}
      />
    ) : (
      <BasicProfileIcon
        size={size}
        onClick={handleClick}
        user={user}
        className={iconClassName}
      />
    );

  if (!wrapped) return icon;

  // The wrapper is exactly the circle, so rows line up on the circle itself.
  // Decorations live in a layer of their own and spill over whatever's
  // around them rather than taking up room
  return (
    <span className={cn('relative inline-flex flex-none', className)}>
      {icon}
      {decoration && (
        <span className="absolute inset-0 z-20 pointer-events-none">
          {decoration}
        </span>
      )}
      {badge}
    </span>
  );
};
