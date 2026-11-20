import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import type { ReactNode } from '@tanstack/react-router';
import type { DailyPrompt } from '@/api/Api';
import { queryKeys, useGetDailyPrompt, useSubmitDailyPrompt } from '@/api/Api';
import { useAIDialogue } from '@/ai/AIDialogue';

type DailyPromptContextType = {
  dailyPrompt: DailyPrompt | undefined;
  submitPrompt: (
    png: Blob,
    {
      onSuccess,
      onError,
    }: {
      onSuccess: () => void;
      onError: () => void;
    },
  ) => void;
  isLoading: boolean;
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
    {
      onSuccess,
      onError,
    }: {
      onSuccess: () => void;
      onError: () => void;
    },
  ) => {
    return submitPromptMutation.mutate(png, {
      onSuccess: (submission) => {
        onSuccess();
        // The AI judge (if on) pops up to say its piece as soon as it's done
        if (submission.id) watchReview(submission.id);
        queryClient.invalidateQueries({ queryKey: queryKeys.daily });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        // You're now on today's roll call, and new trophies may have unlocked
        queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
        queryClient.invalidateQueries({ queryKey: ['trophies'] });
      },
      onError: onError,
    });
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
