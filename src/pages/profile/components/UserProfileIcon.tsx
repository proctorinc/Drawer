import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { cn, getTwoCapitalLetters, nameToColor } from '@/utils';
import { useNavigate } from '@tanstack/react-router';
import useUser from '@/auth/hooks/useUser';

const userProfileIconVariants = cva(
  'cursor-pointer select-none rounded-full font-semibold flex items-center justify-center hover:scale-110 transition-all duration-300',
  {
    variants: {
      size: {
        sm: 'w-9 h-9 text-sm shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]',
        lg: 'w-12 h-12 text-lg shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]',
        xl: 'w-20 h-20 text-3xl shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]',
        '2xl': 'w-30 h-30 text-5xl shadow-[5px_5px_0_0_rgba(0,0,0,0.2)]',
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
    <div className={cn('relative group', className)}>
      <div
        className={cn(
          'font-bold shadow-border/80 font-accent tracking-widest',
          userProfileIconVariants({ size }),
        )}
        style={{
          backgroundColor: primary,
          color: textColor,
          transform: isLoaded ? 'scale(1)' : 'scale(1.25)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={handleClick}
      >
        {name}
      </div>
    </div>
  );
};
