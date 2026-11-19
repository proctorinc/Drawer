import type { FC, ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { RankCard } from '@/levels/RankCard';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type Props = {
  userProfile: GetMeResponse;
  /** Tapping the avatar; defaults to opening the profile */
  onAvatarClick?: () => void;
  /** Pinned to the avatar's bottom-left corner (the level badge has the right), e.g. an edit button */
  avatarBadge?: ReactNode;
  /** Extra lines under the stats, e.g. a trophy count */
  extra?: ReactNode;
  /** Dress the cover for their rank; level is undefined while it loads */
  ranked?: boolean;
  level?: number;
  /** Full-width content inside the cover, under the avatar row */
  footer?: ReactNode;
  /** The row of buttons under the cover */
  children?: ReactNode;
};

/** The sketchbook's cover: whose book it is and how full it's getting */
const UserHeader: FC<Props> = ({
  userProfile,
  onAvatarClick,
  avatarBadge,
  extra,
  ranked,
  level,
  footer,
  children,
}) => {
  const stats = [
    { value: userProfile.prompts.length, label: 'doodles' },
    { value: userProfile.stats.currentStreak, label: 'streak' },
    { value: userProfile.friends.length, label: 'pals' },
  ];

  const row = (
    <div className="relative flex items-center gap-4">
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
        <div className="flex gap-3 text-pencil">
          {stats.map((stat) => (
            <span key={stat.label}>
              <b className="font-accent font-bold text-[22px] text-[color:var(--rank-text,var(--color-ink))]">
                {stat.value}
              </b>{' '}
              {stat.label}
            </span>
          ))}
        </div>
        {extra}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      {ranked ? (
        <RankCard level={level} contentClassName="flex flex-col gap-3 p-4">
          {row}
          {footer}
        </RankCard>
      ) : (
        <div className="flex flex-col gap-3 p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil">
          {row}
          {footer}
        </div>
      )}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default UserHeader;
