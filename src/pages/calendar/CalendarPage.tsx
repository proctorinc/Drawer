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
import { Card, CardContent, CardHeader } from '@/components/Card';

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

  return (
    <Layout>
      {userProfile && (
        <>
          <Banner icon={faFire}>
            You're on a {userProfile.stats.currentStreak} day streak!
          </Banner>
          <Card>
            <CardContent className="pb-0">
              <CardHeader
                title="My Doodles"
                subtitle="See all your doodles"
              ></CardHeader>
            </CardContent>
            <div className="w-full border-t-2 border-border" />
            <CardContent className="pt-0">
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
        </>
      )}
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
