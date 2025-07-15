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
    canvasData: string,
    onSuccess: (imageUrl: string) => void,
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

  const submitPrompt = async (
    canvasData: string,
    onSuccess: (imageUrl: string) => void,
  ) => {
    return submitPromptMutation.mutate(canvasData, {
      onSuccess: (response) => {
        onSuccess(response.imageUrl);
        queryClient.invalidateQueries({ queryKey: queryKeys.daily });
        queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      },
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
