import { useGetUserAchievements, useGetUserTrophies } from '../api';
import UserHeader from './UserHeader';
import type { PublicTrophies } from '../api';
import type { FC, ReactNode } from 'react';
import type { GetMeResponse, User } from '@/api/Api';
import type { LeaderboardEntry } from '@/api/trophies';
import { useGetTrophies } from '@/api/trophies';
import { AchievementSticker } from '@/pages/trophies/components/AchievementCard';
import { levelTitle } from '@/levels/ranks';
import ProgressBar from '@/pages/trophies/components/ProgressBar';
import { rankCardFor } from '@/levels/rankCards';

/** Where they sit on your friend leaderboard, ties sharing a place */
function boardPlace(board: Array<LeaderboardEntry>, userId: string) {
  const entry = board.find((e) => e.user.id === userId);
  if (!entry) return null;
  if (entry.xp === 0) return null;
  const place = board.findIndex((e) => e.xp === entry.xp) + 1;
  return `#${place} of ${board.length} on your board`;
}

/** Their level, XP and board rank, for the bottom of their cover */
const FriendLevel: FC<{ user: User; trophies: PublicTrophies }> = ({
  user,
  trophies,
}) => {
  const { data: mine } = useGetTrophies();
  const { level, xp, levelStartXp, nextLevelXp } = trophies.level;
  const { tier, card } = rankCardFor(level);
  const place = mine && boardPlace(mine.leaderboard, user.id);

  return (
    <div className="flex flex-col gap-2 pt-3 border-t-2 border-dashed border-current/25">
      <div className="flex items-end justify-between gap-2">
        <h2 className="font-accent font-bold text-[26px] leading-none">
          <span className="highlight">{levelTitle(level).toLowerCase()}</span>
        </h2>
        <span className="text-pencil text-right">
          lv {level} · {tier.name.toLowerCase()}
        </span>
      </div>
      <ProgressBar
        value={xp - levelStartXp}
        max={nextLevelXp - levelStartXp}
        label={`${user.username}'s level ${level} progress`}
        fillBackground={card.fill}
      />
      <div className="flex justify-between gap-2 text-pencil">
        <span>
          <b className="font-accent text-xl text-[color:var(--rank-text)]">
            {xp}
          </b>{' '}
          XP
        </span>
        {place && <span className="text-right">{place}</span>}
      </div>
    </div>
  );
};

/** Their cover and level in one card, dressed for their rank */
export const FriendHeader: FC<{
  userProfile: GetMeResponse;
  children?: ReactNode;
}> = ({ userProfile, children }) => {
  const { user } = userProfile;
  const { data: trophies } = useGetUserTrophies(user.id);

  return (
    <UserHeader
      userProfile={userProfile}
      ranked
      level={trophies?.level.level}
      footer={trophies && <FriendLevel user={user} trophies={trophies} />}
    >
      {children}
    </UserHeader>
  );
};

/** The stickers they've earned, newest first */
export const FriendStickers: FC<{ user: User }> = ({ user }) => {
  const { data: achievements } = useGetUserAchievements(user.id);

  if (!achievements) return null;

  const earned = achievements
    .filter((a) => a.achievedAt)
    .sort(
      (a, b) =>
        new Date(b.achievedAt!).getTime() - new Date(a.achievedAt!).getTime(),
    );

  return (
    <section className="flex flex-col gap-4 w-full">
      <div className="flex items-end justify-between gap-2">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          sticker book
        </h2>
        <span className="text-pencil">
          {earned.length}/{achievements.length} collected
        </span>
      </div>
      {earned.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch shadow-pencil">
          {earned.map((achievement, i) => (
            <AchievementSticker
              key={achievement.id}
              achievement={achievement}
              index={i}
            />
          ))}
        </ul>
      ) : (
        <p className="w-full p-4 text-center text-pencil bg-white border-2 border-dashed border-pencil rounded-sketch">
          no stickers yet. one doodle and they're on the board.
        </p>
      )}
    </section>
  );
};
