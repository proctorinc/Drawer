import { Link } from '@tanstack/react-router';
import Badge from './Badge';
import {
  AchievementBar,
  AchievementCount,
  completion,
} from './AchievementMeter';
import type { CSSProperties, FC } from 'react';
import type { Achievement } from '@/api/Api';
import Chip from '@/components/Chip';
import XPSticker from '@/components/XPSticker';
import { cn } from '@/utils';

const stickerTilts = ['-6deg', '4deg', '-2deg', '7deg', '-4deg'];

/** Element id that `/draw/profile/me/stickers#sticker-<id>` links scroll to */
export const stickerAnchor = (achievement: Achievement) =>
  `sticker-${achievement.id}`;

/** The router scrolls hash targets to the top; this margin centers them */
const anchorMargin = 'scroll-mt-[calc(50vh-5rem)]';

/** An earned achievement, stuck into the sticker book */
export const AchievementSticker: FC<{
  achievement: Achievement;
  index: number;
  /** The sticker a link pointed at: glows and wiggles */
  highlighted?: boolean;
}> = ({ achievement, index, highlighted }) => (
  <li
    id={stickerAnchor(achievement)}
    className={cn(
      'flex flex-col items-center gap-1 text-center animate-drop rotate-[var(--tilt)]',
      anchorMargin,
      highlighted && 'bg-me rounded-sketch shadow-[0_0_0_6px_var(--color-me)]',
    )}
    style={
      {
        '--tilt': stickerTilts[index % stickerTilts.length],
        animationDelay: `${index * 70}ms`,
      } as CSSProperties
    }
  >
    <div
      className={cn(
        'relative',
        highlighted && 'animate-[wiggle_0.6s_ease-in-out_600ms_2]',
      )}
    >
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

/** Element id that `/draw/achievements#achievement-<id>` links scroll to */
export const achievementAnchor = (achievement: Achievement) =>
  `achievement-${achievement.id}`;

const cardClass =
  'flex items-center gap-3 w-full p-3 bg-white border-2 border-ink rounded-sketch';

/** An achievement still being worked on */
const AchievementCard: FC<{
  achievement: Achievement;
  /** Tapping it opens it on the achievements page, among its category */
  linked?: boolean;
}> = ({ achievement, linked }) => {
  const almostThere = completion(achievement) >= 0.75;
  const body = (
    <>
      <Badge achievement={achievement} locked className="size-14 shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-accent font-bold text-xl leading-none truncate">
              {achievement.name}
            </h3>
            {achievement.xp > 0 && <XPSticker xp={achievement.xp} />}
          </div>
          <AchievementCount achievement={achievement} />
        </div>
        <p className="text-sm text-pencil leading-tight">
          {achievement.description}
          {achievement.best !== undefined && (
            <span className="text-pencil/70"> · best {achievement.best}</span>
          )}
        </p>
        <AchievementBar
          achievement={achievement}
          fill={almostThere ? 'bg-coral' : 'bg-me'}
        />
        {(almostThere || achievement.reward) && (
          <div className="flex flex-wrap gap-1.5">
            {almostThere && (
              <Chip className="h-6 text-sm bg-blush">almost there!</Chip>
            )}
            {achievement.reward && (
              <Chip className="h-6 text-sm bg-me">
                unlocks {achievement.reward.name.toLowerCase()}
              </Chip>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <li id={stickerAnchor(achievement)} className={cn('flex', anchorMargin)}>
      {linked ? (
        <Link
          to="/draw/achievements"
          search={{ tab: achievement.category }}
          hash={achievementAnchor(achievement)}
          className={cn(cardClass, 'press shadow-pencil-sm hover:bg-paper transition-colors')}
        >
          {body}
        </Link>
      ) : (
        <div className={cardClass}>{body}</div>
      )}
    </li>
  );
};

export default AchievementCard;
