import type { FC, ReactNode } from 'react';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { useLocation, useNavigate } from '@tanstack/react-router';
import LoadingScreen from '@/components/LoadingScreen';

type Props = {
  children: ReactNode;
};

const AuthProvider: FC<Props> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading: isProfileLoading, userProfile } = useProfile();
  const { isLoading: isPromptLoading } = useDailyPrompt();

  const isPublicPage =
    location.pathname.startsWith('/app/login') ||
    location.pathname.startsWith('/app/create-profile');

  if (!isPublicPage && (isProfileLoading || isPromptLoading)) {
    return <LoadingScreen />;
  }

  if (!isPublicPage && !isProfileLoading && !userProfile) {
    console.log('Rerouting to /app/create-profile');
    navigate({ to: '/app/create-profile' });
  }

  return <>{children}</>;
};

export default AuthProvider;
