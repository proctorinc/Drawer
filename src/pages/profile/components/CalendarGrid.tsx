import type { CSSProperties } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { parseDay } from '@/days';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  today: Date;
  month: Date;
  prompts: Array<UserPromptSubmission>;
  /** The day they joined, at midnight; earlier days can't be missed */
  joined: Date;
  onDrawingClick: (drawing: UserPromptSubmission) => void;
};

/** The month's days in whole weeks, starting on the Sunday before the 1st */
function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;

  return Array.from(
    { length: cells },
    (_, i) =>
      new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i),
  );
}

const CalendarGrid = ({
  today,
  month,
  prompts,
  joined,
  onDrawingClick,
}: Props) => {
  const drawingsByDay = new Map(
    prompts.map((prompt) => [parseDay(prompt.day).toDateString(), prompt]),
  );

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((day, i) => (
        <div key={i} className="text-center text-pencil">
          {day}
        </div>
      ))}
      {monthDays(month).map((date, i) => {
        const drawing = drawingsByDay.get(date.toDateString());
        const isToday = date.toDateString() === today.toDateString();
        const isMissed = !drawing && date >= joined && date < today;
        const isFuture = date > today;

        return (
          <button
            key={date.toISOString()}
            disabled={!drawing}
            aria-label={
              drawing
                ? `${drawing.prompt}, ${date.toLocaleDateString()}`
                : undefined
            }
            className={cn(
              'relative aspect-square cursor-pointer disabled:cursor-default transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] animate-in zoom-in-50 fade-in fill-mode-both',
              drawing
                ? 'bg-white p-[3px] border-[1.5px] border-ink rotate-[var(--tilt)] hover:rotate-0 hover:scale-110'
                : 'rounded-md',
              isToday &&
                'outline-2 outline-dashed outline-coral outline-offset-2',
              (isFuture || date.getMonth() !== month.getMonth()) &&
                'opacity-40',
            )}
            style={
              {
                // A stable little tilt per date, so stamped days look hand-stuck
                '--tilt': `${((date.getDate() * 37) % 7) - 3}deg`,
                animationDelay: `${i * 12}ms`,
              } as CSSProperties
            }
            onClick={() => drawing && onDrawingClick(drawing)}
          >
            {drawing ? (
              <DrawingImage
                imageUrl={drawing.imageUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'w-full h-full rounded-md',
                  date >= joined &&
                    !isFuture &&
                    'border-[1.5px] border-dashed border-line',
                  isMissed && 'bg-line/25',
                )}
              />
            )}
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center font-accent font-bold text-lg',
                drawing
                  ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
                  : isMissed
                    ? 'text-pencil/60'
                    : 'text-ink',
              )}
            >
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
