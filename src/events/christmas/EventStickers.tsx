import { useState } from 'react';
import StickerGoal from './StickerGoal';
import StickerReward from './StickerReward';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import Sheet from '@/pages/profile/components/Sheet';

/**
 * The event's stickers by what each takes to earn; tapping anywhere opens a
 * drawer previewing the decoration each one unlocks.
 */
const EventStickers: FC<{ stickers: Array<Achievement> }> = ({ stickers }) => {
  const [showRewards, setShowRewards] = useState(false);
  const hasRewards = stickers.some((s) => s.reward);

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
          view rewards →
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
      </Sheet>
    </>
  );
};

export default EventStickers;
