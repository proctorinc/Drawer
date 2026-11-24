import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import type { ReactNode } from '@tanstack/react-router';
import type { DailyPrompt, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useGetDailyPrompt, useSubmitDailyPrompt } from '@/api/Api';
import { useAIDialogue } from '@/ai/AIDialogue';
import { refreshProgress } from '@/animations/useProgressWatcher';

type DailyPromptContextType = {
  dailyPrompt: DailyPrompt | undefined;
  submitPrompt: (png: Blob, options: SubmitOptions) => void;
  isLoading: boolean;
};

type SubmitOptions = {
  /** The prompt it's for; yesterday's when finishing a doodle late */
  day?: string;
  onSuccess: (submission: UserPromptSubmission) => void;
  onError: () => void;
};

const DailyPromptContext = createContext<DailyPromptContextType | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

export const DailyPromptProvider: FC<Props> = ({ children }) => {
  const { data, isLoading } = useGetDailyPrompt();
  const submitPromptMutation = useSubmitDailyPrompt();
  const queryClient = useQueryClient();
  const { watchReview } = useAIDialogue();

  const submitPrompt = (
    png: Blob,
    { day, onSuccess, onError }: SubmitOptions,
  ) => {
    return submitPromptMutation.mutate(
      { png, day },
      {
        onSuccess: (submission) => {
          onSuccess(submission);
          // The AI judge (if on) pops up to say its piece as soon as it's done
          if (submission.id) watchReview(submission.id);
          queryClient.invalidateQueries({ queryKey: queryKeys.daily });
          queryClient.invalidateQueries({
            queryKey: queryKeys.unfinishedPrompt,
          });
          // A redo used up
          queryClient.invalidateQueries({ queryKey: queryKeys.redos });
          queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
          // You're now on today's roll call, and new trophies may have unlocked
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
          // XP, stickers and quests, which the progress watcher celebrates
          refreshProgress(queryClient);
        },
        onError: onError,
      },
    );
  };

  const contextData = {
    dailyPrompt: data,
    submitPrompt,
    isLoading,
  };

  return (
    <DailyPromptContext.Provider value={contextData}>
      {children}
    </DailyPromptContext.Provider>
  );
};

export const useDailyPrompt = (): DailyPromptContextType => {
  const context = useContext(DailyPromptContext);
  if (!context) {
    throw new Error('useDailyPrompt must be used within a DailyPromptProvider');
  }
  return context;
};
