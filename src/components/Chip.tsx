import type { FC, HTMLAttributes } from 'react';
import { cn } from '@/utils';

/** A small hand-outlined label, e.g. "8h 12m left" */
const Chip: FC<HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 h-7 px-2.5 bg-white border-[1.5px] border-ink rounded-[14px_10px_14px_12px] text-[15px] whitespace-nowrap',
      className,
    )}
    {...props}
  />
);

export default Chip;
