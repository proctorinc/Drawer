import ChristmasTree from './ChristmasTree';
import EventBadge from './EventBadge';
import type { FC } from 'react';
import { useEventRecap } from '@/api/events';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';

type Props = {
  slug: string;
  className?: string;
};

/** End-of-event look back: badge, stats, the finished tree and every doodle */
const EventRecap: FC<Props> = ({ slug, className }) => {
  const { data: recap } = useEventRecap(slug);
  if (!recap) return null;

  const stats = [
    { value: recap.stats.doodles, label: 'doodles' },
    { value: recap.stats.reactionsReceived, label: 'reactions' },
    { value: recap.stats.longestStreak, label: 'best streak' },
  ];

  return (
    <div className={cn('flex flex-col items-center gap-6 w-full', className)}>
      <EventBadge days={recap.event.countdownDays ?? recap.stats.doodles} />
      <div className="grid grid-cols-3 gap-3 w-full stagger">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center py-2 bg-white border-[1.5px] border-ink rounded-sketch-alt"
          >
            <span className="font-accent font-bold text-3xl leading-none">
              {stat.value}
            </span>
            <span className="text-pencil">{stat.label}</span>
          </div>
        ))}
      </div>
      <ChristmasTree event={recap.event} />
      <div className="grid grid-cols-4 gap-2 w-full">
        {recap.submissions.map((submission, i) => (
          <div
            key={submission.id}
            className="p-1 bg-white border-[1.5px] border-ink animate-drop"
            style={{
              rotate: `${((i * 37) % 7) - 3}deg`,
              animationDelay: `${i * 40}ms`,
            }}
          >
            <DrawingImage imageUrl={submission.imageUrl} draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventRecap;
