import { useState } from 'react';
import StickerGoal, { StickerCount, stickerCard } from './StickerGoal';
import StickerReward from './StickerReward';
import { isGrinchAchievement } from './eventAchievements';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import Sheet from '@/pages/profile/components/Sheet';
import Badge from '@/pages/trophies/components/Badge';
import { cn } from '@/utils';

/** What a secret says about itself: the Grinch's give away whose they are */
const secretHint = (a: Achievement) =>
  isGrinchAchievement(a) ? 'the grinch is up to something' : 'a secret';

/**
 * Something else to earn during the event: no flair, just an ornament and XP.
 * Same card as the headline stickers, dashed until it's yours.
 */
const ExtraSticker: FC<{ achievement: Achievement }> = ({ achievement }) => {
  const earned = !!achievement.achievedAt;
  return (
    <span className={cn(stickerCard(earned), 'row-span-3')}>
      {!achievement.secret && <StickerCount sticker={achievement} />}
      <Badge
        achievement={achievement}
        locked={!earned}
        className="w-12 h-13"
      />
      <span
        className={cn(
          'font-accent font-bold text-lg leading-none',
          !earned && 'text-pencil',
        )}
      >
        {achievement.name}
      </span>
      <span
        className={cn(
          'self-end text-sm leading-tight',
          !earned && 'text-pencil',
        )}
      >
        {achievement.secret
          ? secretHint(achievement)
          : achievement.description.toLowerCase()}
      </span>
    </span>
  );
};

type Props = {
  /** The headline stickers, each unlocking flair */
  stickers: Array<Achievement>;
  /** Everything else to earn during the event, secrets included */
  extras?: Array<Achievement>;
};

/**
 * The event's stickers by what each takes to earn; tapping anywhere opens a
 * drawer previewing the decoration each one unlocks, and everything else
 * there is to earn below them.
 */
const EventStickers: FC<Props> = ({ stickers, extras = [] }) => {
  const [showRewards, setShowRewards] = useState(false);
  const hasRewards = stickers.some((s) => s.reward) || extras.length > 0;

  const goals = (
    <span className="grid grid-cols-3 gap-2 w-full stagger">
      {stickers.map((sticker) => (
        <StickerGoal key={sticker.id} sticker={sticker} />
      ))}
    </span>
  );

  if (!hasRewards) return goals;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowRewards(true)}
        className="group flex flex-col items-center gap-2 w-full cursor-pointer"
      >
        {goals}
        <span className="font-accent font-bold text-xl text-pencil group-hover:text-ink transition-colors">
          view rewards
          {extras.length > 0 && ` & ${extras.length} more`} →
        </span>
      </button>

      <Sheet
        title="christmas rewards"
        open={showRewards}
        onClose={() => setShowRewards(false)}
      >
        <p className="-mt-3 text-pencil">
          earn a sticker to wear its decoration on your face
        </p>
        <div className="grid grid-cols-3 gap-2 w-full">
          {stickers.map((sticker) => (
            <StickerReward key={sticker.id} sticker={sticker} />
          ))}
        </div>

        {extras.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-accent font-bold text-2xl leading-none">
              more to find
            </h3>
            <p className="-mt-1 text-pencil">
              ornaments and XP for your tree. watch out for the grinch
            </p>
            <div className="grid grid-cols-3 gap-2 w-full">
              {extras.map((achievement) =>
                // One with flair (the Grinch's hat) shows it, like the stickers up top
                achievement.reward && !achievement.secret ? (
                  <StickerReward key={achievement.id} sticker={achievement} />
                ) : (
                  <ExtraSticker key={achievement.id} achievement={achievement} />
                ),
              )}
            </div>
          </section>
        )}
      </Sheet>
    </>
  );
};

export default EventStickers;
