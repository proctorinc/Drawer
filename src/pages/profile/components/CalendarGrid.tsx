import type { CSSProperties } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import type { CalendarEvent } from '@/events/useCalendarEvent';
import { parseDay } from '@/days';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { GoldTrim, isMasterpiece } from '@/ai/Masterpiece';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { cn } from '@/utils';
import EventIcon from '@/events/EventIcon';
import { Present } from '@/events/christmas/Decorations';
import { XMAS_COLORS } from '@/events/useChristmas';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  today: Date;
  month: Date;
  prompts: Array<UserPromptSubmission>;
  /** The day they joined, at midnight; earlier days can't be missed */
  joined: Date;
  /** The live or upcoming event, whose days are marked until they're drawn */
  event?: CalendarEvent | null;
  onDrawingClick: (drawing: UserPromptSubmission) => void;
};

/** YYYY-MM-DD for a local date, matching a prompt's `day` */
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
  event,
  onDrawingClick,
}: Props) => {
  const isLocked = useIsDrawingLocked();
  const drawingsByDay = new Map(
    prompts.map((prompt) => [parseDay(prompt.day).toDateString(), prompt]),
  );
  // Each event day keeps its mark until a doodle lands on it
  const eventDays = new Map(event?.days.map((day, i) => [day, i]));

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
        const inMonth = date.getMonth() === month.getMonth();
        const eventDay = drawing ? undefined : eventDays.get(dayKey(date));
        const isEventDay = event && eventDay !== undefined;
        const isPresent = isEventDay && event.theme === 'christmas';
        const color = XMAS_COLORS[(eventDay ?? 0) % XMAS_COLORS.length];

        return (
          <button
            key={date.toISOString()}
            disabled={!drawing}
            aria-label={
              drawing
                ? `${drawing.prompt}, ${date.toLocaleDateString()}`
                : isEventDay
                  ? `${event.name}, ${date.toLocaleDateString()}`
                  : undefined
            }
            className={cn(
              'relative aspect-square cursor-pointer disabled:cursor-default transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] animate-in zoom-in-50 fade-in fill-mode-both',
              drawing
                ? 'p-[3px] border-[1.5px] border-ink rotate-[var(--tilt)] hover:rotate-0 hover:scale-110'
                : 'rounded-md',
              drawing &&
                (!isLocked(drawing) && isMasterpiece(drawing)
                  ? 'bg-gold'
                  : 'bg-white'),
              isToday &&
                'outline-2 outline-dashed outline-coral outline-offset-2',
              // Event days stay bright ahead of time, so they read as something to look forward to
              (isFuture || !inMonth) &&
                !(isEventDay && inMonth) &&
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
            {drawing && !isLocked(drawing) && isMasterpiece(drawing) && (
              <GoldTrim size="sm" label />
            )}
            {drawing && isLocked(drawing) ? (
              <LockedDrawing className="border-0" />
            ) : drawing ? (
              <DrawingImage
                imageUrl={drawing.imageUrl}
                className="w-full h-full object-cover"
              />
            ) : isPresent ? (
              <Present
                box={color}
                ribbon={
                  color === XMAS_COLORS[2] ? XMAS_COLORS[0] : XMAS_COLORS[2]
                }
                className={cn(
                  'w-full h-full rotate-[var(--tilt)]',
                  isMissed && 'opacity-60',
                )}
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
            {isEventDay && !isPresent && (
              <EventIcon
                theme={event.theme}
                name={event.name}
                size={14}
                className="absolute top-0.5 right-0.5"
              />
            )}
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center font-accent font-bold text-lg',
                isPresent
                  ? // A little gift tag on the box, so the date still reads
                    'inset-auto left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 min-w-[1.6em] px-0.5 text-sm leading-tight bg-paper border-[1.5px] border-ink rounded-sm text-ink'
                  : drawing
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
