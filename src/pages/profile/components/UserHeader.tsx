import type { FC, ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { FlameIcon } from '@/components/icons';
import { RankCard } from '@/levels/RankCard';
import { cn } from '@/utils';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type Props = {
  userProfile: GetMeResponse;
  /** Tapping the avatar; defaults to opening the profile */
  onAvatarClick?: () => void;
  /** Pinned to the avatar's bottom-left corner (the level badge has the right), e.g. an edit button */
  avatarBadge?: ReactNode;
  /**
   * Pinned to the cover's top-right corner, e.g. a settings menu. It sits
   * outside the cover so a dropdown from it isn't clipped by the cover's edge
   */
  corner?: ReactNode;
  /** Extra lines under the stats, e.g. a trophy count */
  extra?: ReactNode;
  /** Dress the cover for their rank; level is undefined while it loads */
  ranked?: boolean;
  level?: number;
  /** Their rank title, right under their name */
  title?: string;
  /** Full-width content inside the cover, under the avatar row */
  footer?: ReactNode;
  /** Right under the cover, e.g. the friends/drawings/stickers row */
  stats?: ReactNode;
  /** The row of buttons under the cover */
  children?: ReactNode;
};

/** The sketchbook's cover: whose book it is and how full it's getting */
const UserHeader: FC<Props> = ({
  userProfile,
  onAvatarClick,
  avatarBadge,
  corner,
  extra,
  ranked,
  level,
  title,
  footer,
  stats,
  children,
}) => {
  const streak = userProfile.stats.currentStreak;

  const row = (
    <div className={cn('relative flex items-center gap-4', corner && 'pr-10')}>
      <div className="relative flex-none -rotate-4">
        <UserProfileIcon
          user={userProfile.user}
          size="xl"
          onClick={onAvatarClick}
        />
        {avatarBadge && (
          <div className="absolute -bottom-1 -left-2">{avatarBadge}</div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        <h1 className="font-accent font-bold text-[30px] leading-none truncate">
          {userProfile.user.username}
        </h1>
        {title && (
          <span className="-mt-0.5 font-accent font-bold text-xl leading-none text-[color:var(--rank-text,var(--color-ink))]">
            <span className="highlight">{title}</span>
          </span>
        )}
        <span className="flex items-center gap-1 text-pencil">
          <FlameIcon
            size={18}
            className={cn(
              'text-ink',
              streak > 0 && 'animate-flicker origin-bottom',
            )}
          />
          <b className="font-accent font-bold text-[22px] text-[color:var(--rank-text,var(--color-ink))]">
            {streak}
          </b>
          day streak
        </span>
        {extra}
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col gap-4 w-full">
      {ranked ? (
        <RankCard level={level} contentClassName="flex flex-col gap-3 p-4">
          {row}
          {footer}
        </RankCard>
      ) : (
        <div className="flex flex-col gap-3 p-4 bg-white border-2 border-ink rounded-sketch">
          {row}
          {footer}
        </div>
      )}
      {corner && <div className="absolute top-3 right-3 z-20">{corner}</div>}
      {stats}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default UserHeader;
