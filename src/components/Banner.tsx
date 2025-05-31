import { cn } from '@/utils';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { FC, HTMLAttributes, ReactNode } from 'react';

type Props = {
  icon?: IconDefinition;
  children?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const Banner: FC<Props> = ({ icon, className, children, ...props }) => {
  return (
    <div
      className={cn(
        'flex gap-2 justify-center items-center rounded-2xl border-2 border-border bg-border px-4 py-2 w-full text-sm font-bold text-primary',
        className,
      )}
      {...props}
    >
      {icon && <FontAwesomeIcon icon={icon} />}
      {children}
    </div>
  );
};

export default Banner;
