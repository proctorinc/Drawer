import type { FC } from 'react';
import { cn } from '@/utils';
import { PushPin } from '@/components/PushPin';

type Props = {
  /** Days in the countdown, e.g. 29 */
  days: number;
  className?: string;
};

/** The "Doodle-vember" sticker, with how many days of doodles it runs */
const EventBadge: FC<Props> = ({ days, className }) => (
  <div
    role="img"
    aria-label={`Doodle-vember, ${days} days of doodles`}
    className={cn(
      'relative flex flex-col items-center px-5 pt-4 pb-3 bg-white border-[2.5px] border-ink rounded-[20px_14px_22px_16px/16px_22px_14px_20px] shadow-pencil -rotate-2 animate-drop',
      className,
    )}
  >
    <PushPin
      color={'var(--color-xmas-red)'}
      lean={16}
      className="absolute z-10 -top-[23px] left-1/2 -ml-4"
    />
    <span className="font-accent font-bold text-[46px] leading-[0.8]">
      doodle-
    </span>
    <span className="font-accent font-bold text-[46px] leading-[0.8] text-xmas-red">
      vember
    </span>
    <span className="mt-1.5 text-base tracking-[2px] uppercase text-xmas-green">
      {days} days of doodles
    </span>
  </div>
);

export default EventBadge;
