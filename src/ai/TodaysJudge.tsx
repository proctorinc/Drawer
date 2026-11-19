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

/**
 * A tiny "judged by" note for the drawing desk: the judge's face and name,
 * opening a drawer about them. Shows nothing when judging is off.
 */
export const TodaysJudgeChip: FC<{ className?: string }> = ({ className }) => {
  const { data } = useTodaysJudge();
  const [open, setOpen] = useState(false);
  if (!data) return null;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1 cursor-pointer hover:text-ink',
          className,
        )}
      >
        <AIJudgeAvatar judge={data.judge} size="xs" />
        <span>
          judged by <span className="underline">{data.judge.name}</span>
        </span>
      </button>
      <AIJudgeDrawer
        judge={data.judge}
        criteria={data.criteria}
        note={`${data.judge.name} will score your doodle today and leave a comment on it.`}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
