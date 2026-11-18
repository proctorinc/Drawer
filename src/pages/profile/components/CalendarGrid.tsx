import { cn } from '@/utils';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import type { UserPromptSubmission } from '@/api/Api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX } from '@fortawesome/free-solid-svg-icons';

type Props = {
  today: Date;
  prompts?: Array<UserPromptSubmission>;
  userCreatedAt?: Date;
  onCellClick: (
    drawing: UserPromptSubmission | undefined,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  currentDate: Date;
};

const CalendarGrid = ({
  today,
  prompts,
  userCreatedAt,
  onCellClick,
  currentDate,
}: Props) => {
  return (
    <div className="grid grid-cols-7 gap-1 relative">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div
          key={day}
          className="text-center text-sm font-semibold text-secondary"
        >
          {day}
        </div>
      ))}
      {Array.from({ length: 35 }, (_, i) => {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1 -
            new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1,
            ).getDay() +
            i,
        );
        const drawing = prompts?.find(
          (prompt) =>
            new Date(prompt.day).toDateString() === date.toDateString(),
        );
        const createdAtDate = userCreatedAt
          ? new Date(userCreatedAt)
          : new Date();
        const isToday = date.toDateString() === today.toDateString();
        const isBeforeUserCreation = date < createdAtDate;
        const isMissedDay =
          !isBeforeUserCreation && !drawing && date < today && !isToday;

        return (
          <div
            key={i}
            className={cn(
              'aspect-square relative cursor-pointer transition-[scale,rotate] duration-300 ease-[var(--ease-spring)] animate-in zoom-in-50 fade-in fill-mode-both',
              drawing
                ? 'bg-white p-[3px] border-[1.5px] border-ink rotate-[var(--tilt)] hover:rotate-0 hover:scale-110'
                : 'rounded-md',
              isToday &&
                'outline-2 outline-dashed outline-coral outline-offset-2',
              date.getMonth() !== currentDate.getMonth() ? 'opacity-50' : '',
            )}
            style={
              {
                // A stable little tilt per date, so stamped days look hand-stuck
                '--tilt': `${((date.getDate() * 37) % 7) - 3}deg`,
                animationDelay: `${i * 12}ms`,
              } as React.CSSProperties
            }
            onClick={(e) => onCellClick(drawing, e)}
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
                  isBeforeUserCreation
                    ? 'bg-transparent'
                    : 'border-[1.5px] border-dashed border-line',
                )}
              />
            )}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center text-sm font-bold',
                drawing
                  ? 'text-card drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
                  : 'text-primary',
              )}
            >
              {date.getDate()}
            </div>
            {isMissedDay && (
              <FontAwesomeIcon
                icon={faX}
                size="2x"
                className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 absolute text-primary/20"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
