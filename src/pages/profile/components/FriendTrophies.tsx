import { useGetUserAchievements, useGetUserTrophies } from '../api';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import type { LeaderboardEntry } from '@/api/trophies';
import { useGetTrophies } from '@/api/trophies';
import { AchievementSticker } from '@/pages/trophies/components/AchievementCard';
import { levelTitle } from '@/pages/trophies/components/LevelCard';
import ProgressBar from '@/pages/trophies/components/ProgressBar';

/** Where they sit on your friend leaderboard this week, ties sharing a place */
function weeklyPlace(board: Array<LeaderboardEntry>, userId: string) {
  const entry = board.find((e) => e.user.id === userId);
  if (!entry) return null;
  if (entry.xp === 0) return 'napping this week';
  const place = board.findIndex((e) => e.xp === entry.xp) + 1;
  return `#${place} of ${board.length} on your board this week`;
}

/** Their level, XP and weekly rank, like the top of the Trophies page */
export const FriendLevelCard: FC<{ user: User }> = ({ user }) => {
  const { data: trophies } = useGetUserTrophies(user.id);
  const { data: mine } = useGetTrophies();

  if (!trophies) return null;

  const { level, xp, levelStartXp, nextLevelXp } = trophies.level;
  const place = mine && weeklyPlace(mine.leaderboard, user.id);

  return (
    <section className="relative flex flex-col gap-3 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch shadow-pencil">
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-1/2 -ml-8 w-16 h-5 bg-sky/90 rotate-2"
      />
      <div className="flex items-center gap-4">
        <div className="relative grid place-items-center size-16 shrink-0 bg-butter border-2 border-ink rounded-blob -rotate-6">
          <span className="font-accent font-bold text-[36px] leading-none">
            {level}
          </span>
          <span className="absolute -bottom-2 px-1.5 bg-coral text-white text-xs border-2 border-ink rounded-sketch rotate-3">
            LEVEL
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-pencil truncate">{user.username} is a…</span>
          <h2 className="font-accent font-bold text-[30px] leading-none">
            <span className="highlight">{levelTitle(level).toLowerCase()}</span>
          </h2>
        </div>
      </div>
      <ProgressBar
        value={xp - levelStartXp}
        max={nextLevelXp - levelStartXp}
        label={`${user.username}'s level ${level} progress`}
      />
      <div className="flex justify-between gap-2 text-pencil">
        <span>
          <b className="font-accent text-xl text-ink">{xp}</b> XP
        </span>
        {place && <span className="text-right">{place}</span>}
      </div>
    </section>
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
