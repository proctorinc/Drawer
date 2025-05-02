import { createContext, useContext, useEffect, useState } from 'react';
import { fetchDailyPrompt,submitDailyPrompt, type DailyPrompt } from '@/api/Api'; // Adjust the path as needed
import { useProfile } from '@/profile/UserProfileContext';

type DailyPromptContextType = {
    dailyPrompt: DailyPrompt | null;
    submitPrompt: (imageBlob: Blob) => Promise<void>;
};

const DailyPromptContext = createContext<DailyPromptContextType | undefined>(undefined);

export const DailyPromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dailyPrompt, setDailyPrompt] = useState<DailyPrompt | null>(null);
    const { reloadUser } = useProfile();

    const submitPrompt = async (imageBlob: Blob) => {
        submitDailyPrompt(imageBlob).then(() => {
            reloadUser();
        })
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
