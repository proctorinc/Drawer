import { useState } from 'react';
import Layout from '@/components/Layout';
import { useProfile } from '@/pages/profile/UserProfileContext';
import DrawingModal from '@/components/DrawingModal';
import type { UserPromptSubmission } from '@/api/Api';
import CalendarGrid from './components/CalendarGrid';
import {
  faChevronLeft,
  faChevronRight,
  faFire,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Banner from '@/components/Banner';
import { Card, CardContent } from '@/components/Card';
import Button from '@/components/Button';
import SubmissionList from '../profile/components/SubmissionList';

const CalendarPage = () => {
  const { userProfile } = useProfile();
  const [selectedDrawing, setSelectedDrawing] =
    useState<UserPromptSubmission | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>(
    'calendar',
  );

  const handleCellClick = (
    drawing: UserPromptSubmission | undefined,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!drawing) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setClickPosition({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
    setSelectedDrawing(drawing);
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

  if (!userProfile) {
    return <></>;
  }

  return (
    <Layout>
      <Banner icon={faFire}>
        You're on a {userProfile.stats.currentStreak} day streak!
      </Banner>
      <div className="flex flex-col items-center w-full">
        <h3 className="text-xl font-bold text-primary">My Doodles</h3>
        <p className="font-bold text-secondary">
          Checkout your drawing history
        </p>
      </div>
      <div className="flex gap-2 w-full">
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
      </div>
      {displayMode === 'calendar' && (
        <Card>
          <CardContent>
            <CalendarGrid
              onCellClick={handleCellClick}
              currentDate={currentDate}
            />
            <div className="flex justify-center items-center gap-4 w-full">
              <button
                onClick={() => navigateMonth('prev')}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  className="text-primary"
                />
              </button>
              <span className="font-semibold text-primary min-w-[120px] text-center">
                {formatMonthYear(currentDate)}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className="text-primary"
                />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {displayMode === 'list' && <SubmissionList />}

      <DrawingModal
        drawing={selectedDrawing}
        onClose={() => {
          setSelectedDrawing(null);
          setClickPosition(null);
        }}
        initialPosition={clickPosition}
      />
    </Layout>
  );
};

export default CalendarPage;
