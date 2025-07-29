import { useEffect, useState } from 'react';
import { userProfileIconVariants } from './UserProfileIcon';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn, getTwoCapitalLetters, nameToColor } from '@/utils';

type Props = {
  user?: User;
  className?: string;
  onClick?: () => void;
} & VariantProps<typeof userProfileIconVariants>;

export const BasicProfileIcon: FC<Props> = ({
  user,
  className,
  size,
  onClick,
}) => {
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
        onClick={onClick}
      >
        {name}
      </div>
    </div>
  );
};
