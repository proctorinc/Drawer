import Badge from './Badge';
import ProgressBar from './ProgressBar';
import type { CSSProperties, FC } from 'react';
import type { Achievement } from '@/api/Api';
import Chip from '@/components/Chip';

const stickerTilts = ['-6deg', '4deg', '-2deg', '7deg', '-4deg'];

/** An earned achievement, stuck into the sticker book */
export const AchievementSticker: FC<{
  achievement: Achievement;
  index: number;
}> = ({ achievement, index }) => (
  <li
    className="flex flex-col items-center gap-1 text-center animate-drop rotate-[var(--tilt)]"
    style={
      {
        '--tilt': stickerTilts[index % stickerTilts.length],
        animationDelay: `${index * 70}ms`,
      } as CSSProperties
    }
  >
    <div className="relative">
      <Badge achievement={achievement} className="size-20" />
      {achievement.reward && (
        <span className="absolute -top-1 -right-3 px-1.5 bg-coral text-white text-xs border-2 border-ink rounded-sketch rotate-12">
          unlock!
        </span>
      )}
    </div>
    <span className="font-accent font-bold text-lg leading-none mt-1">
      {achievement.name}
    </span>
    <span className="text-xs text-pencil leading-tight">
      {achievement.description}
    </span>
    {achievement.achievedAt && (
      <span className="text-xs text-pencil/80">
        {new Date(achievement.achievedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    )}
  </li>
);

/** An achievement still being worked on */
const AchievementCard: FC<{ achievement: Achievement }> = ({ achievement }) => {
  const { progress, achievementValue: goal } = achievement;
  const almostThere = goal > 0 && progress / goal >= 0.75;

  return (
    <li className="flex items-center gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm">
      <Badge achievement={achievement} locked className="size-14 shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-accent font-bold text-xl leading-none truncate">
            {achievement.name}
          </h3>
          <span className="font-accent font-bold text-lg leading-none whitespace-nowrap">
            {Math.min(progress, goal)}/{goal}
          </span>
        </div>
        <p className="text-sm text-pencil leading-tight">
          {achievement.description}
        </p>
        <ProgressBar
          value={progress}
          max={goal}
          label={`${achievement.name} progress`}
          fill={almostThere ? 'bg-coral' : 'bg-butter'}
          className="h-3"
        />
        {(almostThere || achievement.reward) && (
          <div className="flex flex-wrap gap-1.5">
            {almostThere && (
              <Chip className="h-6 text-sm bg-blush">almost there!</Chip>
            )}
            {achievement.reward && (
              <Chip className="h-6 text-sm bg-butter">
                unlocks {achievement.reward.name.toLowerCase()}
              </Chip>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export default AchievementCard;
