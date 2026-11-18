import Polaroid from './Polaroid';
import type { FC, ReactNode } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import Chip from '@/components/Chip';
import { PencilIcon } from '@/components/icons';
import { dabShapes } from '@/utils';

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
  new Date(day)
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

type Props = {
  /** Shown right after today's polaroids */
  afterToday?: ReactNode;
};

export const SubmissionFeedList: FC<Props> = ({ afterToday }) => {
  const { profile } = useMyProfilePage();
  const { dailyPrompt } = useDailyPrompt();
  const groups = groupByDay(profile?.feed ?? []);

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-10 w-full">
      {!dailyPrompt && (
        <div className="flex flex-col items-center gap-1 w-full text-center">
          <h1 className="font-accent font-bold text-[32px] leading-none">
            no prompt today
          </h1>
          <p className="text-lg text-pencil">
            take a breather, there's a fresh page tomorrow
          </p>
        </div>
      )}
      {groups.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-10 text-center text-pencil text-lg">
          <PencilIcon size={40} strokeWidth={1.6} className="animate-nudge" />
          nothing pinned yet. go draw something!
        </div>
      )}
      {groups.map((group) => {
        // Compare dates only, in case one side carries a time
        const isToday =
          !!dailyPrompt &&
          group.day.slice(0, 10) === dailyPrompt.day.slice(0, 10);
        const { prompt, colors, createdBy } = group.submissions[0];
        const friendsPinned = group.submissions.filter(
          (submission) => submission.user.id !== profile.user.id,
        ).length;
        const stillDrawing = isToday
          ? Math.max(profile.friends.length - friendsPinned, 0)
          : 0;

        return (
          <section key={group.day} className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-end">
              <h2 className="font-accent font-bold text-[32px] leading-none">
                {isToday ? "today's wall" : dayLabel(group.day)}
              </h2>
              <span className="text-pencil text-[17px]">
                {group.submissions.length} pinned
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip>
                <span className="flex gap-0.5">
                  {colors.slice(0, 3).map((color, i) => (
                    <span
                      key={color + i}
                      className={`size-2.5 ${dabShapes[i % dabShapes.length]}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                {prompt.toLowerCase()}
              </Chip>
              {createdBy && (
                <Chip className="bg-sky">by {createdBy.username}</Chip>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 pt-3">
              {group.submissions.map((submission, index) => (
                <Polaroid
                  key={submission.id}
                  submission={submission}
                  index={index}
                />
              ))}
              {stillDrawing > 0 && <StillDrawing count={stillDrawing} />}
            </div>
            {isToday && afterToday && <div className="pt-6">{afterToday}</div>}
          </section>
        );
      })}
    </div>
  );
};
