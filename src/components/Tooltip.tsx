import { cn } from '@/utils';
import { useState, type FC, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const tooltipVariants = cva(
  'z-10 absolute bg-base text-card-foreground rounded-full text-lg whitespace-nowrap transition-opacity duration-200 font-bold shadow-lg',
  {
    variants: {
      location: {
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      },
    },
    defaultVariants: {
      location: 'left',
    },
  },
);

type Props = {
  show?: boolean;
  content?: ReactNode;
  children?: ReactNode;
  tooltipClassName?: ReactNode;
  className?: string;
} & VariantProps<typeof tooltipVariants>;

const Tooltip: FC<Props> = ({
  show = true,
  content,
  children,
  location,
  tooltipClassName,
  className,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (show) {
      setIsTooltipVisible(!isTooltipVisible);
    }
  };

  const handleTooltipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!show) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)} onClick={handleClick}>
      {children}
      {show && (
        <div
          className={cn(
            tooltipVariants({ location }),
            isTooltipVisible ? 'opacity-100' : 'opacity-0',
            tooltipClassName,
          )}
          onClick={handleTooltipClick}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
