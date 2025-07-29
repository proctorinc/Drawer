import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { userProfileIconVariants } from './UserProfileIcon';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn, getTwoCapitalLetters, nameToColor } from '@/utils';
import useUser from '@/auth/hooks/useUser';

type Props = {
  user?: User;
  className?: string;
  onClick?: () => void;
  forceType?: 'basic' | 'custom';
} & VariantProps<typeof userProfileIconVariants>;

export const CustomProfileIcon: FC<Props> = ({
  user,
  className,
  size,
  onClick,
}) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger the scale-down animation after mount
    setIsLoaded(true);
  }, []);

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

  const name = getTwoCapitalLetters(user.username);
  const { primary, text: textColor } = nameToColor(user.username);
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (user.id === currentUser.id) {
      navigate({ to: '/draw/profile/me' });
    } else {
      navigate({ to: `/draw/profile/${user.id}` });
    }
  };

  return (
    <div className={cn('flex relative group justify-center', className)}>
      <div
        className={cn(
          'font-bold shadow-border font-accent tracking-widest',
          userProfileIconVariants({ size }),
        )}
        style={{
          backgroundColor: primary,
          color: textColor,
          transform: isLoaded ? 'scale(1)' : 'scale(1.25)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <img
          src={user.avatarUrl === '' ? '/default-avatar.png' : user.avatarUrl}
          alt={name}
          className="rounded-full"
          onClick={handleClick}
        />
      </div>
    </div>
  );
};
