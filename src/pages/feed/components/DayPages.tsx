import { useEffect, useRef } from 'react';
import Polaroid from './Polaroid';
import { FriendsToday } from './FriendsToday';
import { ColorDabs, PromptCredit, PromptTitle } from './PromptTitle';
import type { FC, ReactNode } from 'react';
import type { DailyPrompt, UserPromptSubmission } from '@/api/Api';
import { useFeed } from '@/api/Api';
import { useChristmas } from '@/events/useChristmas';
import Lights from '@/events/christmas/Lights';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { PencilIcon } from '@/components/icons';
import { isSameDay, parseDay } from '@/days';

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

/** A day's prompt, its colors and who came up with it */
const DayHeader = ({
  label,
  prompt,
  pinned,
  children,
}: {
  /** Small line above the prompt, like the date */
  label?: ReactNode;
  prompt: DailyPrompt;
  pinned: number;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-3">
    {label}
    <PromptTitle prompt={prompt.prompt} colors={prompt.colors} />
    {prompt.createdBy && <PromptCredit user={prompt.createdBy} />}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-pencil">
      <ColorDabs colors={prompt.colors} />
      <span className="ml-auto">{pinned} pinned</span>
    </div>
    {children}
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
  return (
    <section className="flex flex-col gap-3 w-full">
      {header ?? (
        <DayHeader
          label={<span className="-mb-2 text-lg text-pencil">{title}</span>}
          prompt={submissions[0]}
          pinned={submissions.length}
        />
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
  const { data: feed } = useFeed();
  if (!profile || !feed) return null;

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

  // Today is always on the first page
  const today = feed.pages[0].submissions.filter((submission) =>
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
        <DayHeader
          label={
            christmas && (
              <span className="-mb-2 font-cursive text-2xl text-xmas-green">
                today's tree
              </span>
            )
          }
          prompt={dailyPrompt}
          pinned={today.length}
        >
          <FriendsToday />
        </DayHeader>
      }
      submissions={today}
      lastTile={stillDrawing > 0 && <StillDrawing count={stillDrawing} />}
    />
  );
};

/** Earlier days load a page at a time as you scroll down to them */
export const PastPages = () => {
  const { dailyPrompt } = useDailyPrompt();
  const { data: feed, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const pastDays = groupByDay(
    feed?.pages.flatMap((page) => page.submissions) ?? [],
  ).filter((group) => !dailyPrompt || !isSameDay(group.day, dailyPrompt.day));

  // A fresh observer after each page reports right away if the sentinel is
  // still in view (short days), so we keep loading until the page fills
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feed?.pages.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (pastDays.length === 0 && !hasNextPage) return null;

  return (
    <div className="flex flex-col gap-10 w-full pt-4">
      {pastDays.map((group) => (
        <DayPage
          key={group.day}
          title={dayLabel(group.day)}
          submissions={group.submissions}
        />
      ))}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex justify-center text-pencil"
          aria-hidden="true"
        >
          <PencilIcon size={28} strokeWidth={1.6} className="animate-nudge" />
        </div>
      )}
    </div>
  );
};
