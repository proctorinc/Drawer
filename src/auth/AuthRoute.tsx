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
  const { isAuthenticated, isFetching } = useAuth();

  const isPrivateRoute = !location.pathname.startsWith('/auth');

  if (!isFetching && !isAuthenticated && isPrivateRoute) {
    navigate({ to: '/auth/login' });
  }

  return isAuthenticated ? children : <LoadingScreen />;
};

export default AuthRoute;
