import { useState } from 'react';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { StarIcon } from '@/components/icons';
import { cn } from '@/utils';
import EventSticker from '@/events/christmas/EventSticker';

/**
 * Art lives in src/assets/badges, named after what the achievement counts
 * (e.g. submission_streak-5.png, or .svg for the ones drawn by
 * scripts/badges/generate.mjs). Bundling it lets us know up front which
 * milestones have art, so the rest go straight to the star instead of
 * requesting a file that 404s.
 */
const BADGE_ART = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('@/assets/badges/*.{png,svg}', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [
    path
      .split('/')
      .pop()!
      .replace(/\.(png|svg)$/, ''),
    url,
  ]),
);

const badgeSrc = (achievement: Achievement): string | undefined =>
  achievement.imageUrl ||
  BADGE_ART[
    `${achievement.achievementField.toLowerCase()}-${achievement.achievementValue}`
  ];

type Props = {
  achievement: Achievement;
  /** Not earned yet: shown as a faded preview */
  locked?: boolean;
  className?: string;
};

/** An achievement's sticker art, falling back to a star when it has none */
const Badge: FC<Props> = ({ achievement, locked, className }) => {
  const [missing, setMissing] = useState(false);

  if (achievement.secret) {
    return (
      <MysteryBadge
        event={achievement.category === 'events'}
        className={className}
      />
    );
  }

  if (achievement.eventSlug) {
    return (
      <EventSticker
        achievement={achievement}
        locked={locked}
        className={className}
      />
    );
  }

  const src = badgeSrc(achievement);

  if (missing || !src) {
    return (
      <div
        className={cn(
          'grid place-items-center border-2 border-ink rounded-blob',
          locked ? 'border-dashed border-pencil text-pencil' : 'bg-me',
          className,
        )}
      >
        <StarIcon size={24} fill={locked ? undefined : 'white'} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setMissing(true)}
      className={cn(locked && 'grayscale opacity-40', className)}
    />
  );
};

/** A secret not found yet: a dashed outline with a question mark */
export const MysteryBadge: FC<{ event?: boolean; className?: string }> = ({
  event,
  className,
}) => (
  <svg viewBox="0 0 48 52" aria-hidden="true" className={className}>
    {event ? (
      <>
        <path
          d="M24 2v6"
          stroke="var(--color-pencil)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <rect
          x="17"
          y="7"
          width="14"
          height="7"
          rx="1.5"
          fill="none"
          stroke="var(--color-pencil)"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <circle
          cx="24"
          cy="32"
          r="18"
          fill="none"
          stroke="var(--color-pencil)"
          strokeWidth={2.2}
          strokeDasharray="4 4"
        />
      </>
    ) : (
      <circle
        cx="24"
        cy="26"
        r="21"
        fill="none"
        stroke="var(--color-pencil)"
        strokeWidth={2.2}
        strokeDasharray="4 4"
      />
    )}
    <text
      x="24"
      y={event ? 39 : 33}
      textAnchor="middle"
      fontSize="20"
      fontWeight="700"
      fill="var(--color-pencil)"
      className="font-accent"
    >
      ?
    </text>
  </svg>
);

export default Badge;
