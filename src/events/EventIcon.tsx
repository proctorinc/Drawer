import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import type { FC } from 'react';
import { SantaHatIcon } from '@/events/christmas/Decorations';
import { cn } from '@/utils';

type Props = {
  /** The event's theme, which picks its icon */
  theme: string;
  /** The event's name, shown on hover and read by screen readers */
  name: string;
  size?: number;
  className?: string;
};

/** A small mark standing for an event, e.g. a santa hat for Christmas */
const EventIcon: FC<Props> = ({ theme, name, size = 20, className }) => (
  <span
    role="img"
    aria-label={name}
    title={name}
    className={cn(
      'inline-flex items-center justify-center shrink-0',
      className,
    )}
    style={{ width: size, height: size }}
  >
    {theme === 'christmas' ? (
      <SantaHatIcon size={size} />
    ) : (
      <FontAwesomeIcon icon={faStar} className="text-xmas-gold" />
    )}
  </span>
);

export default EventIcon;
