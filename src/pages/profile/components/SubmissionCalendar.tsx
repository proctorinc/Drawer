import { useState, type FC } from 'react';
import DrawingModal from '@/components/DrawingModal';
import type { GetMeResponse, UserPromptSubmission } from '@/api/Api';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Card, CardContent, CardHeader } from '@/components/Card';
import CalendarGrid from '@/pages/profile/components/CalendarGrid';
import { useNavigate } from '@tanstack/react-router';
import useUser from '@/auth/hooks/useUser';

type Props = {
  profile?: GetMeResponse;
};

const SubmissionCalendar: FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const [selectedDrawing, setSelectedDrawing] =
    useState<UserPromptSubmission | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  //   const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>(
  //     'calendar',
  //   );

  const handleCellClick = (
    drawing: UserPromptSubmission | undefined,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    if (drawing?.id) {
      navigate({ to: `/draw/submission/${drawing.id}` });
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <>
      {/* <div className="flex gap-2 w-full">
        <Button
          className="w-full bg-secondary/50 border-base disabled:bg-card disabled:ring-3 disabled:ring-border/50"
          size="sm"
          onClick={() => setDisplayMode('calendar')}
          disabled={displayMode === 'calendar'}
          disableLoad
        >
          Calendar
        </Button>
        <Button
          className="w-full bg-secondary/50 border-base disabled:bg-card disabled:ring-3 disabled:ring-border/50"
          size="sm"
          onClick={() => setDisplayMode('list')}
          disabled={displayMode === 'list'}
          disableLoad
        >
          List
        </Button>
      </div> */}
      {/* {displayMode === 'calendar' && ( */}
      <Card>
        <CardContent>
          <CardHeader title="All Drawings" />
          <CalendarGrid
            userCreatedAt={profile?.user.createdAt}
            prompts={profile?.prompts}
            onCellClick={handleCellClick}
            currentDate={currentDate}
          />
          <div className="flex justify-center items-center gap-4 w-full">
            <button
              onClick={() => navigateMonth('prev')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-primary" />
            </button>
            <span className="font-semibold text-primary min-w-[120px] text-center">
              {formatMonthYear(currentDate)}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-primary" />
            </button>
          </div>
        </CardContent>
      </Card>
      {/* )}

      {displayMode === 'list' && <SubmissionList />} */}

      <DrawingModal
        drawing={selectedDrawing}
        onClose={() => {
          setSelectedDrawing(null);
          setClickPosition(null);
        }}
        initialPosition={clickPosition}
      />
    </>
  );
};

export default SubmissionCalendar;
