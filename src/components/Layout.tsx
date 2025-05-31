import { Config } from '@/config/Config';
import type { FC, ReactNode } from 'react';
import Navbar from './Navbar';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import LoadingScreen from './LoadingScreen';
import Header from './Header';

type Props = {
  hideAppName?: boolean;
  children: ReactNode;
};

const Layout: FC<Props> = ({ hideAppName, children }) => {
  const { isLoading: isProfileLoading } = useProfile();
  const { isLoading: isPromptLoading } = useDailyPrompt();

  if (isProfileLoading || isPromptLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex justify-center">
      <div className="relative flex flex-col flex-grow items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-24 max-w-md">
        <Header />
        {children}
        {hideAppName && (
          <h1 className="text-sm mt-20 font-cursive tracking-widest text-secondary">
            {Config.APP_NAME}
          </h1>
        )}
        <Navbar />
      </div>
    </div>
  );
};

export default Layout;
