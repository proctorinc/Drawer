import { cn } from '@/utils';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';
import type { UserPromptSubmission } from '@/api/Api';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX } from '@fortawesome/free-solid-svg-icons';

type Props = {
  onCellClick: (
    drawing: UserPromptSubmission | undefined,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  currentDate: Date;
};

const CalendarGrid = ({ onCellClick, currentDate }: Props) => {
  const today = new Date();
  const { userProfile } = useProfile();

  if (!userProfile) {
    return <></>;
  }

  return (
    <div className="grid grid-cols-7 gap-1">
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
        const drawing = userProfile.prompts.find(
          (prompt) =>
            new Date(prompt.day).toDateString() === date.toDateString(),
        );
        const isToday = date.toDateString() === today.toDateString();
        const isBeforeUserCreation =
          date < new Date(userProfile.user.createdAt);
        const isMissedDay =
          !isBeforeUserCreation && !drawing && date < today && !isToday;

        return (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-lg relative overflow-hidden cursor-pointer hover:scale-105 transition-all duration-300',
              isToday ? 'ring-2 ring-primary' : '',
              date.getMonth() !== currentDate.getMonth() ? 'opacity-50' : '',
            )}
            onClick={(e) => onCellClick(drawing, e)}
          >
            {drawing ? (
              <CanvasRenderer
                canvasData={drawing.canvasData}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'w-full h-full',
                  isBeforeUserCreation ? 'bg-card' : 'bg-border',
                  isMissedDay && 'bg-secondary/50',
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
              {isToday && (
                <div className="flex items-center justify-center rounded-full w-8 h-8 bg-card">
                  {date.getDate()}
                </div>
              )}
              {!isToday && date.getDate()}
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
