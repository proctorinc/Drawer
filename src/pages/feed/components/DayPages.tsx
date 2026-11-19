import { useState } from 'react';
import Polaroid from './Polaroid';
import { ColorDabs, PromptTitle } from './PromptTitle';
import type { FC, ReactNode } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { useChristmas } from '@/events/useChristmas';
import Lights from '@/events/christmas/Lights';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import Chip from '@/components/Chip';
import { ArrowLeftIcon, PencilIcon } from '@/components/icons';
import { isSameDay, parseDay } from '@/days';
import { cn } from '@/utils';

type DayGroup = {
  day: string;
  submissions: Array<UserPromptSubmission>;
};

function groupByDay(feed: Array<UserPromptSubmission>): Array<DayGroup> {
  const groups: Array<DayGroup> = [];
  for (const submission of feed) {
    const last = groups.at(-1);
    if (last?.day === submission.day) {
      last.submissions.push(submission);
    } else {
      groups.push({ day: submission.day, submissions: [submission] });
    }
  }
  return groups;
}

const dayLabel = (day: string) =>
  parseDay(day)
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toLowerCase();

const StillDrawing = ({ count }: { count: number }) => (
  <div className="flex flex-col items-center justify-center gap-1.5 mt-3 p-3 min-h-48 border-2 border-dashed border-[#a79f93] rounded-[10px_14px_8px_12px] text-[#5e5868] text-lg text-center animate-drop">
    <PencilIcon size={36} strokeWidth={1.6} className="animate-nudge" />
    {count} {count === 1 ? 'friend' : 'friends'} still drawing…
  </div>
);

type DayPageProps = {
  /** Defaults to the day's prompt under a small date line */
  header?: ReactNode;
  title?: string;
  submissions: Array<UserPromptSubmission>;
  /** Extra tile at the end of the grid */
  lastTile?: ReactNode;
  /** Christmas event: polaroids hang from a string of lights */
  festive?: boolean;
};

/** One day's prompt and its pinned polaroids */
const DayPage: FC<DayPageProps> = ({
  header,
  title,
  submissions,
  lastTile,
  festive = false,
}) => {
  const { prompt, colors, createdBy } = submissions[0];

  return (
    <section className="flex flex-col gap-3 w-full">
      {header ?? (
        <>
          <div className="flex justify-between items-end">
            <h2 className="font-accent font-bold text-[32px] leading-none">
              {title}
            </h2>
            <span className="text-pencil text-[17px]">
              {submissions.length} pinned
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip>
              <ColorDabs colors={colors} size="sm" />
              {prompt.toLowerCase()}
            </Chip>
            {createdBy && (
              <Chip className="bg-sky">by {createdBy.username}</Chip>
            )}
          </div>
        </>
      )}
      {festive && <Lights bulbs={8} className="-mx-6 -mb-6" />}
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 pt-3">
        {submissions.map((submission, index) => (
          <Polaroid
            key={submission.id}
            submission={submission}
            index={index}
            festive={festive}
          />
        ))}
        {lastTile}
      </div>
    </section>
  );
};

/** Today's polaroids, with a placeholder for friends who haven't pinned one yet */
export const TodayWall = () => {
  const { profile } = useMyProfilePage();
  const { dailyPrompt } = useDailyPrompt();
  const christmas = useChristmas();
  if (!profile) return null;

  if (!dailyPrompt) {
    return (
      <div className="flex flex-col items-center gap-1 w-full text-center">
        <h1 className="font-accent font-bold text-[32px] leading-none">
          no prompt today
        </h1>
        <p className="text-lg text-pencil">
          take a breather, there's a fresh page tomorrow
        </p>
      </div>
    );
  }

  const today = profile.feed.filter((submission) =>
    isSameDay(submission.day, dailyPrompt.day),
  );
  if (today.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-10 text-center text-pencil text-lg">
        <PencilIcon size={40} strokeWidth={1.6} className="animate-nudge" />
        nothing pinned yet. go draw something!
      </div>
    );
  }

  const friendsPinned = today.filter(
    (submission) => submission.user.id !== profile.user.id,
  ).length;
  const stillDrawing = Math.max(profile.friends.length - friendsPinned, 0);

  return (
    <DayPage
      festive={!!christmas}
      header={
        <div className="flex flex-col gap-3">
          {christmas && (
            <span className="-mb-2 font-cursive text-2xl text-xmas-green">
              today's tree
            </span>
          )}
          <PromptTitle
            prompt={dailyPrompt.prompt}
            colors={dailyPrompt.colors}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-pencil">
            <ColorDabs colors={dailyPrompt.colors} />
            {dailyPrompt.createdBy && (
              <Chip className="bg-sky">
                by {dailyPrompt.createdBy.username}
              </Chip>
            )}
            <span className="ml-auto">{today.length} pinned</span>
          </div>
        </div>
      }
      submissions={today}
      lastTile={stillDrawing > 0 && <StillDrawing count={stillDrawing} />}
    />
  );
};

const DAYS_PER_FLIP = 3;

const bookButtonClass =
  'press inline-flex items-center gap-2 h-11 px-4 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm font-accent font-bold text-xl cursor-pointer';

/** Earlier days stay closed until you flip back to them, a few at a time */
export const PastPages = () => {
  const { profile } = useMyProfilePage();
  const { dailyPrompt } = useDailyPrompt();
  const [daysShown, setDaysShown] = useState(0);

  const pastDays = groupByDay(profile?.feed ?? []).filter(
    (group) => !dailyPrompt || !isSameDay(group.day, dailyPrompt.day),
  );
  if (pastDays.length === 0) return null;

  return (
    <div className="flex flex-col gap-10 w-full pt-4">
      {pastDays.slice(0, daysShown).map((group) => (
        <DayPage
          key={group.day}
          title={dayLabel(group.day)}
          submissions={group.submissions}
        />
      ))}
      <div className="flex flex-wrap justify-center gap-3">
        {daysShown < pastDays.length && (
          <button
            onClick={() => setDaysShown((shown) => shown + DAYS_PER_FLIP)}
            className={bookButtonClass}
          >
            <ArrowLeftIcon size={18} />
            {daysShown === 0 ? 'flip back through past pages' : 'keep flipping'}
          </button>
        )}
        {daysShown > 0 && (
          <button
            onClick={() => setDaysShown(0)}
            className={cn(
              bookButtonClass,
              'bg-transparent shadow-none border-dashed',
            )}
          >
            close the book
          </button>
        )}
      </div>
    </div>
  );
};
