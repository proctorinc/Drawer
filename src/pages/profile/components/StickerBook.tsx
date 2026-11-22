import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { SectionLink } from '@/components/ShowAllLink';
import { bookPage } from '@/pages/profile/useBookOwner';
import { AchievementSticker } from '@/pages/trophies/components/AchievementCard';

/** How many of the newest stickers a profile shows before "show all" */
export const RECENT_STICKERS = 5;

export const earnedNewestFirst = (achievements: Array<Achievement>) =>
  achievements
    .filter((a) => a.achievedAt)
    .sort(
      (a, b) =>
        new Date(b.achievedAt!).getTime() - new Date(a.achievedAt!).getTime(),
    );

type Props = {
  /** 'me' for your own book, otherwise their id */
  userId: string;
  achievements: Array<Achievement>;
  emptyText: string;
};

/** The newest few stickers someone's earned; the rest are a tap away */
const StickerBook: FC<Props> = ({ userId, achievements, emptyText }) => {
  const earned = earnedNewestFirst(achievements);
  const recent = earned.slice(0, RECENT_STICKERS);

  return (
    <section className="flex flex-col gap-4 w-full">
      {earned.length > RECENT_STICKERS ? (
        <SectionLink
          {...bookPage(userId, 'stickers')}
          heading="latest stickers"
          label={`see all ${earned.length}`}
        />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-accent font-bold text-[28px] leading-none">
            latest stickers
          </h2>
          <span className="text-pencil">
            {earned.length}/{achievements.length} collected
          </span>
        </div>
      )}
      {recent.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch">
          {recent.map((achievement, i) => (
            <AchievementSticker
              key={achievement.id}
              achievement={achievement}
              index={i}
            />
          ))}
        </ul>
      ) : (
        <p className="w-full p-4 text-center text-pencil bg-white border-2 border-dashed border-pencil rounded-sketch">
          {emptyText}
        </p>
      )}
    </section>
  );
};

export default StickerBook;
