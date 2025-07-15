import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn, getTwoCapitalLetters, nameToColor } from '@/utils';
import { useState } from 'react';
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
  showTooltip?: boolean;
  onClick?: () => void;
} & VariantProps<typeof userProfileIconVariants>;

export const UserProfileIcon: FC<Props> = ({
  user,
  className,
  size,
  showTooltip = false,
  onClick,
}) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

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
    if (showTooltip) {
      setIsTooltipVisible(!isTooltipVisible);
    }
    if (onClick) {
      onClick();
    } else if (user.id === currentUser.id) {
      navigate({ to: '/draw/profile/me' });
    } else {
      navigate({ to: `/draw/profile/${user.id}` });
    }
  };

  return (
    <div
      className={cn('relative group', className)}
      onMouseEnter={() => showTooltip && setIsTooltipVisible(true)}
      onMouseLeave={() => showTooltip && setIsTooltipVisible(false)}
    >
      <div
        className={cn(
          'font-bold shadow-border/80 font-accent tracking-widest',
          userProfileIconVariants({ size }),
        )}
        style={{
          backgroundColor: primary,
          color: textColor,
        }}
        onClick={handleClick}
      >
        {name}
      </div>
      {showTooltip && (
        <div
          className={cn(
            'absolute font-accent right-full top-1/2 -translate-y-1/2 mr-2 bg-card text-card-foreground rounded-full text-lg whitespace-nowrap transition-opacity duration-200 pointer-events-none px-4 py-2 font-bold',
            isTooltipVisible ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            backgroundColor: primary,
            color: textColor,
          }}
        >
          {user.username}
        </div>
      )}
    </div>
  );
};
