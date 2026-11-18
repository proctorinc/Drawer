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

export const userProfileIconVariants = cva(
  'cursor-pointer select-none rounded-full border-ink flex items-center justify-center hover:scale-110 hover:-rotate-6 transition-[scale,rotate] duration-300 ease-[var(--ease-spring)]',
  {
    variants: {
      size: {
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
} & VariantProps<typeof userProfileIconVariants>;

export const UserProfileIcon: FC<Props> = ({
  user,
  className,
  size,
  onClick,
}) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const christmas = useChristmas();

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

  // With a decoration on, the wrapper takes the caller's classes (position,
  // ring, tilt) so it moves and turns with the avatar
  const iconClassName = decoration ? undefined : className;
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

  if (!decoration) return icon;

  return (
    <span className={cn('relative inline-flex flex-none', className)}>
      {icon}
      {decoration}
    </span>
  );
};
