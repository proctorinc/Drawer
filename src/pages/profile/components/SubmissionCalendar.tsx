import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CalendarGrid from './CalendarGrid';
import type { FC } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { monthIndex, parseDay } from '@/days';
import { Card, CardContent } from '@/components/Card';
import { useDailyPrompt } from '@/daily/DailyPromptContext';

const monthButtonClass =
  'press flex items-center justify-center size-10 bg-white border-2 border-ink rounded-blob shadow-pencil-sm cursor-pointer disabled:invisible';

/** Days of `month` you could have drawn on: from joining (or the 1st) to today */
function drawableDays(month: Date, joined: Date, today: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const from = joined > first ? joined : first;
  const to = today < last ? today : last;
  const day = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / day) + 1);
}

type Props = {
  profile: GetMeResponse;
};

/** Every doodle in the book, one month at a time */
const SubmissionCalendar: FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const { dailyPrompt } = useDailyPrompt();
  // Midnight, so today itself never counts as already gone by
  const today = dailyPrompt
    ? parseDay(dailyPrompt.day)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const [month, setMonth] = useState(today);

  const joined = new Date(profile.user.createdAt);
  joined.setHours(0, 0, 0, 0);
  const canGoBack = monthIndex(month) > monthIndex(joined);
  const canGoForward = monthIndex(month) < monthIndex(today);

  const drawn = profile.prompts.filter(
    (prompt) => monthIndex(parseDay(prompt.day)) === monthIndex(month),
  ).length;
  const drawable = drawableDays(month, joined, today);

  function shiftMonth(by: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + by, 1));
  }

  return (
    <Card>
      <CardContent>
        <div className="flex justify-between items-center gap-2">
          <button
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => shiftMonth(-1)}
            className={monthButtonClass}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-accent font-bold text-[28px] leading-none lowercase">
              {month.toLocaleString('en-US', { month: 'long' })}{' '}
              <span className="text-pencil">{month.getFullYear()}</span>
            </h2>
            <span className="text-pencil">
              {drawn} of {drawable} {drawable === 1 ? 'day' : 'days'} drawn
              {drawable > 0 && drawn === drawable && ' ⭐'}
            </span>
          </div>
          <button
            aria-label="Next month"
            disabled={!canGoForward}
            onClick={() => shiftMonth(1)}
            className={monthButtonClass}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <CalendarGrid
          // Remount per month so the cells pop in again
          key={monthIndex(month)}
          today={today}
          month={month}
          joined={joined}
          prompts={profile.prompts}
          onDrawingClick={(drawing) =>
            navigate({
              to: '/draw/submission/$submissionId',
              params: { submissionId: drawing.id },
            })
          }
        />
      </CardContent>
    </Card>
  );
};

export default SubmissionCalendar;
