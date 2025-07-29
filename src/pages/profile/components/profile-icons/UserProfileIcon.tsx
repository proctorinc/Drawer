import { useNavigate } from '@tanstack/react-router';
import { cva } from 'class-variance-authority';
import { CustomProfileIcon } from './CustomProfileIcon';
import { BasicProfileIcon } from './BasicProfileIcon';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn } from '@/utils';
import useUser from '@/auth/hooks/useUser';

export const userProfileIconVariants = cva(
  'cursor-pointer select-none rounded-full font-semibold flex items-center justify-center hover:scale-110 transition-all duration-300',
  {
    variants: {
      size: {
        sm: 'w-9 h-9 text-sm shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]',
        lg: 'w-12 h-12 text-lg shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]',
        xl: 'w-20 h-20 text-3xl shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]',
        '2xl': 'w-40 h-40 text-7xl shadow-[5px_5px_0_0_rgba(0,0,0,0.2)]',
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

  if (user.avatarType === 'custom' && user.avatarUrl != '') {
    return (
      <CustomProfileIcon
        size={size}
        onClick={handleClick}
        user={user}
        className={className}
      />
    );
  }
  if (user.avatarType === 'basic' || user.avatarUrl === '') {
    return (
      <BasicProfileIcon
        size={size}
        onClick={handleClick}
        user={user}
        className={className}
      />
    );
  }
  // <div className="flex gap-1 justify-center items-center text-xs font-bold absolute bottom-0 -right-2 translate-x-1/2 rounded-full bg-orange-400 text-orange-200 p-1">
  //   <FontAwesomeIcon icon={faFire} /> 56
  // </div>
};
