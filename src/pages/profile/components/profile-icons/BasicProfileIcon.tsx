import { useEffect, useState } from 'react';
import { userProfileIconVariants } from './UserProfileIcon';
import { DefaultAvatar } from './DefaultAvatar';
import { useSketchFace } from './avatarFaces';
import type { AvatarSize } from './DefaultAvatar';
import type { VariantProps } from 'class-variance-authority';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import { cn } from '@/utils';

type Props = {
  user?: User;
  className?: string;
  onClick?: () => void;
} & VariantProps<typeof userProfileIconVariants>;

/** Their sketch face, or the one an admin picked for them */
const SketchAvatar: FC<{ user: User; size: AvatarSize }> = ({ user, size }) => (
  <DefaultAvatar user={user} size={size} parts={useSketchFace(user)} />
);

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

  return (
    <div className={cn('flex relative group justify-center', className)}>
      <div
        role="img"
        aria-label={user.username}
        className={cn(userProfileIconVariants({ size }), 'overflow-hidden')}
        style={{
          transform: isLoaded ? 'scale(1)' : 'scale(1.25)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={onClick}
      >
        <SketchAvatar user={user} size={size ?? 'lg'} />
      </div>
    </div>
  );
};
