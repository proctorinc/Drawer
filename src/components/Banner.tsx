import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { FC, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  icon?: IconDefinition;
  children?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const Banner: FC<Props> = ({ icon, className, children, ...props }) => {
  return (
    <div
      className={cn(
        'flex gap-2 justify-center items-center w-full px-4 py-2 bg-butter border-[1.5px] border-ink rounded-sketch-alt text-base text-ink',
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
