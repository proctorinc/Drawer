import { createContext, useContext, type FC } from 'react';
import {
  useGetDailyPrompt,
  useSubmitDailyPrompt,
  type DailyPrompt,
} from '@/api/Api';
import type { ReactNode } from '@tanstack/react-router';
import { useProfile } from '@/pages/profile/UserProfileContext';

type DailyPromptContextType = {
  dailyPrompt: DailyPrompt | undefined;
  submitPrompt: (canvasData: string, onSuccess: () => void) => Promise<void>;
  isFetching: boolean;
};

const DailyPromptContext = createContext<DailyPromptContextType | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

export const DailyPromptProvider: FC<Props> = ({ children }) => {
  const { data, isFetching } = useGetDailyPrompt();
  const submitPromptMutation = useSubmitDailyPrompt();
  const { reloadUser } = useProfile();

  const submitPrompt = async (canvasData: string, onSuccess: () => void) => {
    return submitPromptMutation.mutate(canvasData, {
      onSuccess: () => {
        onSuccess();
        reloadUser();
      },
    });
  };

  const contextData = {
    dailyPrompt: data,
    submitPrompt,
    isFetching,
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
