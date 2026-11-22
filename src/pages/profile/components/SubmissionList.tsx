import { Link } from '@tanstack/react-router';
import type { CSSProperties, FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { polaroidFrameClass } from '@/components/polaroid';
import { parseDay } from '@/days';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { GoldTrim, goldFrameClass, isMasterpiece } from '@/ai/Masterpiece';
import { cn } from '@/utils';

const TILTS = [-1.5, 1.2, 0.6, -0.8, 1.6, -1.1];

/** Prompts (newest first) bunched into one chapter per month */
function byMonth(prompts: Array<UserPromptSubmission>) {
  const chapters = new Map<string, Array<UserPromptSubmission>>();
  for (const prompt of prompts) {
    const title = parseDay(prompt.day)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toLowerCase();
    chapters.set(title, [...(chapters.get(title) ?? []), prompt]);
  }
  return [...chapters];
}

type Props = {
  prompts: Array<UserPromptSubmission>;
};

/** Every page of the book as little pinned snapshots */
const SubmissionList: FC<Props> = ({ prompts }) => {
  const isLocked = useIsDrawingLocked();
  return (
    <div className="flex flex-col gap-6 w-full">
      {byMonth(prompts).map(([title, chapter]) => (
        <section key={title} className="flex flex-col gap-3">
          <h3 className="flex items-baseline gap-2 font-accent font-bold text-2xl leading-none">
            {title}
            <span className="font-sans font-normal text-base text-pencil">
              {chapter.length} {chapter.length === 1 ? 'doodle' : 'doodles'}
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            {chapter.map((submission, i) => {
              const locked = isLocked(submission);
              const golden = !locked && isMasterpiece(submission);
              return (
                <Link
                  key={submission.id}
                  to="/draw/submission/$submissionId"
                  params={{ submissionId: submission.id }}
                  className={cn(
                    'relative flex flex-col gap-1 p-1.5 pb-1 rotate-[var(--tilt)] transition-[rotate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:scale-105 active:scale-95',
                    golden
                      ? goldFrameClass
                      : polaroidFrameClass,
                  )}
                  style={
                    {
                      '--tilt': `${TILTS[i % TILTS.length]}deg`,
                    } as CSSProperties
                  }
                >
                  {golden && <GoldTrim size="sm" label />}
                  {locked ? (
                    <LockedDrawing />
                  ) : (
                    <div className="aspect-square bg-[#fff8ec] overflow-hidden">
                      <DrawingImage
                        imageUrl={submission.imageUrl}
                        draggable={false}
                      />
                    </div>
                  )}
                  <span className="text-sm leading-tight truncate">
                    {submission.prompt.toLowerCase()}
                  </span>
                  <span className="-mt-1 text-xs text-pencil">
                    {parseDay(submission.day).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default SubmissionList;
