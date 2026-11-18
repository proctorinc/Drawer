import { useState } from 'react';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { StarIcon } from '@/components/icons';
import { cn } from '@/utils';

/** Art lives in public/badges, named after what the achievement counts */
const badgeSrc = (achievement: Achievement) =>
  achievement.imageUrl ||
  `/badges/${achievement.achievementField.toLowerCase()}-${achievement.achievementValue}.png`;

type Props = {
  achievement: Achievement;
  /** Not earned yet: shown as a faded preview */
  locked?: boolean;
  className?: string;
};

/** An achievement's sticker art, falling back to a star when it has none */
const Badge: FC<Props> = ({ achievement, locked, className }) => {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        className={cn(
          'grid place-items-center border-2 border-ink rounded-blob shadow-pencil-sm',
          locked ? 'border-dashed border-pencil text-pencil' : 'bg-butter',
          className,
        )}
      >
        <StarIcon size={24} fill={locked ? undefined : 'white'} />
      </div>
    );
  }

  return (
    <img
      src={badgeSrc(achievement)}
      alt=""
      draggable={false}
      onError={() => setMissing(true)}
      className={cn(locked && 'grayscale opacity-40', className)}
    />
  );
};

export default Badge;
