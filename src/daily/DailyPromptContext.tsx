import { createContext, useContext, useEffect, useState } from 'react';
import { fetchDailyPrompt, submitDailyPrompt, type DailyPrompt } from '@/api/Api';
import { useProfile } from '@/profile/UserProfileContext';

type DailyPromptContextType = {
    dailyPrompt: DailyPrompt | null;
    submitPrompt: (canvasData: string) => Promise<void>;
};

const DailyPromptContext = createContext<DailyPromptContextType | undefined>(undefined);

export const DailyPromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dailyPrompt, setDailyPrompt] = useState<DailyPrompt | null>(null);
    const { reloadUser } = useProfile();

    const submitPrompt = async (canvasData: string) => {
        await submitDailyPrompt(canvasData);
        reloadUser();
    }

    useEffect(() => {
        fetchDailyPrompt().then(setDailyPrompt);
    }, []);

    return (
        <DailyPromptContext.Provider value={{ dailyPrompt, submitPrompt }}>
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
