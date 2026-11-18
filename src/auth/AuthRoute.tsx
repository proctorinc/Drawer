import type { FC, ReactNode } from 'react';
import useAuth from './hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';
import { useLocation, useNavigate } from '@tanstack/react-router';

type Props = {
  children: ReactNode;
};

const AuthRoute: FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isSignedIn, needsProfile, isFetching } = useAuth();

  const isPrivateRoute = !location.pathname.startsWith('/auth');

  if (!isFetching && isPrivateRoute) {
    if (!isSignedIn) {
      navigate({ to: '/auth/login' });
    } else if (needsProfile) {
      navigate({ to: '/auth/sign-up' });
    }
  }

  return isAuthenticated ? children : <LoadingScreen />;
};

export default AuthRoute;
