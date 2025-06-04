import { cn } from '@/utils';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';
import type { UserPromptSubmission } from '@/api/Api';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faX } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

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
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  if (!userProfile) {
    return <></>;
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
    setIsTooltipVisible(true);
  };

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
        const drawing = userProfile.prompts.find(
          (prompt) =>
            new Date(prompt.day).toDateString() === date.toDateString(),
        );
        const isToday = date.toDateString() === today.toDateString();
        const isBeforeUserCreation =
          date < new Date(userProfile.user.createdAt);
        const isUserCreationDay =
          date.toDateString() ===
          new Date(userProfile.user.createdAt).toDateString();
        const isMissedDay =
          !isBeforeUserCreation && !drawing && date < today && !isToday;

        return (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-lg relative cursor-pointer hover:scale-105 transition-all duration-300',
              isToday ? 'ring-2 ring-primary' : '',
              date.getMonth() !== currentDate.getMonth() ? 'opacity-50' : '',
              isUserCreationDay && 'ring-3 ring-border',
            )}
            onClick={(e) => onCellClick(drawing, e)}
            onMouseEnter={isUserCreationDay ? handleMouseEnter : undefined}
            onMouseLeave={() => isUserCreationDay && setIsTooltipVisible(false)}
          >
            {drawing ? (
              <CanvasRenderer
                imageUrl={drawing.imageUrl}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div
                className={cn(
                  'w-full h-full rounded-lg',
                  isBeforeUserCreation ? 'bg-card' : 'bg-border',
                  isMissedDay && 'bg-secondary/50',
                )}
              />
            )}
            {isUserCreationDay && (
              <div className="absolute -top-[8px] -right-[8px] text-primary">
                <FontAwesomeIcon icon={faStar} />
              </div>
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
      {isTooltipVisible && (
        <div
          className="fixed z-[100] px-4 py-2 bg-card border-2 border-border text-primary font-bold rounded-full text-sm whitespace-nowrap shadow-sm"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateX(-50%)',
          }}
        >
          your first day
        </div>
      )}
    </div>
  );
};

export default CalendarGrid;
