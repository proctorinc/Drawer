import { candyCaneTape } from './Decorations';
import type { FC } from 'react';
import { cn } from '@/utils';

type Props = {
  /** Days in the countdown, e.g. 29 */
  days: number;
  className?: string;
};

/** "The 29 doodles of christmas" sticker */
const EventBadge: FC<Props> = ({ days, className }) => (
  <div
    role="img"
    aria-label={`The ${days} doodles of Christmas`}
    className={cn(
      'relative flex flex-col items-center px-5 pt-4 pb-3 bg-white border-[2.5px] border-ink rounded-[20px_14px_22px_16px/16px_22px_14px_20px] shadow-pencil -rotate-2 animate-drop',
      className,
    )}
  >
    <span
      aria-hidden="true"
      className="absolute -top-2.5 left-1/2 -ml-9 w-[72px] h-5 border border-ink/20 rotate-3"
      style={{ background: candyCaneTape() }}
    />
    <span className="text-sm tracking-[3px] uppercase text-pencil">the</span>
    <span className="flex items-baseline gap-2">
      <span className="font-accent font-bold text-[56px] leading-[0.85] text-xmas-red">
        {days}
      </span>
      <span className="font-cursive font-bold text-[38px] leading-[0.9]">
        doodles
      </span>
    </span>
    <span className="text-base tracking-[2px] uppercase text-xmas-green">
      of christmas
    </span>
  </div>
);

export default EventBadge;
