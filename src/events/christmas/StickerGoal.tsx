import EventSticker from './EventSticker';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { cn } from '@/utils';

/** The card both sticker views share: solid once earned, dashed until then */
export const stickerCard = (earned: boolean) =>
  cn(
    'relative grid grid-rows-subgrid justify-items-center gap-2 px-2 pt-4 pb-3 border-2 rounded-sketch text-center',
    earned
      ? 'bg-white border-ink shadow-pencil-sm'
      : 'bg-paper border-dashed border-line',
  );

/** "5/12", for a sticker still being worked on */
export const StickerCount: FC<{ sticker: Achievement }> = ({ sticker }) =>
  sticker.achievedAt ? null : (
    <span className="absolute top-1.5 right-2 text-xs text-pencil tabular-nums">
      {Math.min(sticker.progress, sticker.achievementValue)}/
      {sticker.achievementValue}
    </span>
  );

/** The sticker and its name */
export const StickerFace: FC<{ sticker: Achievement }> = ({ sticker }) => (
  <span className="flex flex-col items-center gap-1">
    <EventSticker
      achievement={sticker}
      locked={!sticker.achievedAt}
      className="w-12 h-13"
    />
    <span
      className={cn(
        'font-accent font-bold text-lg leading-none',
        !sticker.achievedAt && 'text-pencil',
      )}
    >
      {sticker.name}
    </span>
  </span>
);

/** What earning it takes, short enough for a third of a phone's width */
function requirement({
  achievementField,
  achievementValue,
  description,
}: Achievement) {
  switch (achievementField) {
    case 'EVENT_SUBMISSION_TOTAL':
      return achievementValue === 1
        ? 'draw your first christmas doodle'
        : `draw ${achievementValue} christmas doodles`;
    case 'EVENT_COUNTDOWN_TOTAL':
      return 'draw every day till christmas';
    default:
      return description.toLowerCase();
  }
}

/** A sticker by what it takes to earn it: the event page's view */
const StickerGoal: FC<{ sticker: Achievement }> = ({ sticker }) => (
  <span className={cn(stickerCard(!!sticker.achievedAt), 'row-span-2')}>
    <StickerCount sticker={sticker} />
    <StickerFace sticker={sticker} />
    <span
      className={cn(
        'self-end text-sm leading-tight',
        !sticker.achievedAt && 'text-pencil',
      )}
    >
      {requirement(sticker)}
    </span>
  </span>
);

export default StickerGoal;
