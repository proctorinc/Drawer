import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn, getTwoCapitalLetters, nameToColor } from '@/utils';

const userProfileIconVariants = cva(
  'cursor-pointer select-none rounded-full font-semibold flex items-center justify-center hover:opacity-80 hover:scale-110 transition-all duration-300',
  {
    variants: {
      size: {
        sm: 'w-9 h-9 text-sm',
        lg: 'w-12 h-12 text-lg',
      },
    },
    defaultVariants: {
      size: 'lg',
    },
  },
);

type Props = {
  user?: User;
  onClick?: () => void;
  className?: string;
} & VariantProps<typeof userProfileIconVariants>;

export const UserProfileIcon: FC<Props> = ({
  user,
  onClick,
  className,
  size,
}) => {
  if (!user) {
    return (
      <div
        className={cn(
          userProfileIconVariants({ size }),
          'bg-gradient-to-tr from-blue-600 to-purple-600 animate-spin',
          className,
        )}
      ></div>
    );
  }

  const name = getTwoCapitalLetters(user.username);
  const { primary } = nameToColor(name);

  return (
    <div
      className={cn(userProfileIconVariants({ size }), className)}
      style={{ backgroundColor: primary }}
      onClick={onClick}
    >
      {name}
    </div>
  );
};
