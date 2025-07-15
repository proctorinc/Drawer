import type { FC, ReactNode } from 'react';
import useAuth from './hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

type Props = {
  children: ReactNode;
};

const AuthRoute: FC<Props> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? children : <LoadingScreen />;
};

export default AuthRoute;
