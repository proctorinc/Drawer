import type { FC, ReactNode } from 'react';
import Navbar from './Navbar';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import LoadingScreen from './LoadingScreen';
import Header from './Header';
import { useLocation } from '@tanstack/react-router';

type Props = {
  children: ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  const location = useLocation();
  const { isLoading: isProfileLoading } = useProfile();
  const { isLoading: isPromptLoading } = useDailyPrompt();

  const isAuthPage =
    !location.pathname.startsWith('/login') &&
    !location.pathname.startsWith('/create-profile');

  if (isAuthPage && (isProfileLoading || isPromptLoading)) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex justify-center">
      <div className="relative flex flex-col flex-grow items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md">
        <Header />
        {children}
        <Navbar />
      </div>
    </div>
  );
};

export default Layout;
