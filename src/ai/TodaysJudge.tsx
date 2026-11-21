import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { AIJudgeDrawer } from './AIJudgeDrawer';
import type { FC } from 'react';
import type { AICriterionScore, AIJudge } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';
import { cn } from '@/utils';

export interface TodaysJudge {
  judge: AIJudge;
  criteria: Array<Omit<AICriterionScore, 'score'>>;
}

/** Who will score a doodle drawn now; null when judging is off */
export function useTodaysJudge() {
  return useQuery({
    queryKey: ['ai', 'judge', 'today'],
    queryFn: async (): Promise<TodaysJudge | null> => {
      const response = await fetchAPI('GET', '/ai/judge/today');
      if (response.status === 204) return null;
      if (!response.ok) throw new Error("Failed to load today's judge");
      return response.json();
    },
    staleTime: 5 * 60_000,
    // Nice to have: never worth a retry storm or an error on the drawing desk
    retry: false,
  });
}

/** The note's height with criteria boxes under the "judged by" line */
export const JUDGE_STRIP_HEIGHT = '4.375rem';

/**
 * A "judged by" note for the drawing desk: the judge's face and name, and a
 * little box per thing they score. Any of it opens a drawer about them.
 * Shows nothing when judging is off.
 */
export const TodaysJudgeChip: FC<{ className?: string }> = ({ className }) => {
  const { data } = useTodaysJudge();
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const { judge, criteria } = data;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`About ${judge.name}, today's judge`}
        onClick={() => setOpen(true)}
        className={cn(
          'group flex flex-col items-center gap-1.5 w-full h-full cursor-pointer',
          className,
        )}
      >
        <span className="inline-flex items-center gap-1 h-5 group-hover:text-ink">
          <AIJudgeAvatar judge={judge} size="xs" />
          <span>
            judged by <span className="underline">{judge.name}</span>
          </span>
        </span>
        {criteria.length > 0 && (
          <span className="flex gap-1.5 w-full h-11">
            {criteria.map((criterion) => (
              <span
                key={criterion.id}
                className="flex flex-col flex-1 min-w-0 items-center justify-center gap-0.5 px-1 bg-white border-[1.5px] border-ink rounded-sketch-alt text-ink transition-[rotate] duration-300 ease-[var(--ease-spring)] group-hover:odd:-rotate-2 group-hover:even:rotate-2"
              >
                {criterion.imageUrl ? (
                  <img
                    src={criterion.imageUrl}
                    alt=""
                    className="size-5 flex-none object-contain"
                  />
                ) : (
                  <span className="size-2 flex-none rounded-full bg-ink" />
                )}
                <span className="max-w-full font-accent font-bold text-[13px] leading-none truncate">
                  {criterion.name}
                </span>
              </span>
            ))}
          </span>
        )}
      </button>
      <AIJudgeDrawer
        judge={judge}
        criteria={criteria}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
