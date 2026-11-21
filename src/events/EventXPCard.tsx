import { useState } from 'react';
import type { FC } from 'react';
import type { EventXP } from '@/api/events';
import { InfoIcon, StarIcon } from '@/components/icons';
import Sheet from '@/pages/profile/components/Sheet';
import { cn } from '@/utils';

type Props = {
  xp: EventXP;
  className?: string;
};

/**
 * XP earned while an event ran: the event's own actions line by line, then
 * whatever everyday activity added on top.
 */
const EventXPCard: FC<Props> = ({ xp, className }) => {
  const eventXP = xp.lines.reduce((sum, line) => sum + line.xp, 0);
  const everydayXP = xp.total - eventXP;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 w-full p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil',
        className,
      )}
    >
      <p className="flex items-baseline gap-2">
        <span className="font-accent font-bold text-[44px] leading-none">
          {xp.total}
        </span>
        <span className="text-pencil">XP earned during the event</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {xp.lines.map((line) => (
          <li key={line.action} className="flex items-baseline gap-2">
            <span className="flex-1 leading-tight">{line.action}</span>
            <span className="text-sm text-pencil tabular-nums whitespace-nowrap">
              {line.xpEach > 0 ? `${line.count} × ${line.xpEach}` : line.count}
            </span>
            <span className="w-12 text-right font-accent font-bold text-lg tabular-nums">
              +{line.xp}
            </span>
          </li>
        ))}
        <li className="flex items-baseline gap-2 pt-1.5 border-t-2 border-dashed border-line text-pencil">
          <span className="flex-1 leading-tight">Everyday XP on top</span>
          <span className="w-12 text-right font-accent font-bold text-lg tabular-nums">
            +{everydayXP}
          </span>
        </li>
      </ul>
    </div>
  );
};

/**
 * The event's XP total as a chip; tapping it opens a drawer explaining how it
 * was earned.
 */
export const EventXPInfo: FC<{ xp: EventXP; title: string }> = ({
  xp,
  title,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5 h-8 px-2.5 bg-white border-[1.5px] border-ink rounded-[14px_10px_14px_12px] text-[15px] text-ink"
      >
        <StarIcon size={16} fill="var(--color-butter)" />
        <b className="font-accent font-bold text-lg leading-none">{xp.total}</b>
        XP
        <InfoIcon size={18} className="text-pencil" />
        <span className="sr-only">: how it's earned</span>
      </button>
      <Sheet title={title} open={open} onClose={() => setOpen(false)}>
        <p className="-mt-3 text-pencil">
          everything you earned while the event ran, with the event's own
          actions listed
        </p>
        <EventXPCard xp={xp} />
      </Sheet>
    </>
  );
};
