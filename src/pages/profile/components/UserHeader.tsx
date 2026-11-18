import type { FC, ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type Props = {
  userProfile: GetMeResponse;
  /** Tapping the avatar; defaults to opening the profile */
  onAvatarClick?: () => void;
  /** Extra lines under the stats, e.g. a trophy count */
  extra?: ReactNode;
  /** The row of buttons under the cover */
  children?: ReactNode;
};

/** The sketchbook's cover: whose book it is and how full it's getting */
const UserHeader: FC<Props> = ({
  userProfile,
  onAvatarClick,
  extra,
  children,
}) => {
  const stats = [
    { value: userProfile.prompts.length, label: 'doodles' },
    { value: userProfile.stats.currentStreak, label: 'streak' },
    { value: userProfile.friends.length, label: 'pals' },
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="relative flex items-center gap-4 p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 right-8 w-12 h-[18px] bg-coral/50 rotate-6"
        />
        <div className="flex-none -rotate-4">
          <UserProfileIcon
            user={userProfile.user}
            size="xl"
            onClick={onAvatarClick}
          />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="font-accent font-bold text-[30px] leading-none truncate">
            {userProfile.user.username}
          </h1>
          <div className="flex gap-3 text-pencil">
            {stats.map((stat) => (
              <span key={stat.label}>
                <b className="font-accent font-bold text-[22px] text-ink">
                  {stat.value}
                </b>{' '}
                {stat.label}
              </span>
            ))}
          </div>
          {extra}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default UserHeader;
