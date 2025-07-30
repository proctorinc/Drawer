import { createContext, useContext, type FC } from 'react';
import {
  queryKeys,
  useGetDailyPrompt,
  useSubmitDailyPrompt,
  type DailyPrompt,
} from '@/api/Api';
import { type ReactNode } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

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
  ) => Promise<void>;
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
      onSuccess: () => {
        onSuccess();
        queryClient.invalidateQueries({ queryKey: queryKeys.daily });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
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
