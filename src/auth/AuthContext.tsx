import { createContext, useEffect, type FC, type ReactNode } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  useLogoutUser,
  useCreateUser,
  useLoginUser,
  useGetMe,
  type User,
} from '@/api/Api';

type AuthContextType = {
  user?: User;
  isAuthenticated: boolean;
  createUser: (username: string, email: string) => Promise<{ message: string }>;
  login: (email: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  isLoading: boolean;
};

export const AuthProviderContext = createContext<AuthContextType | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

export const AuthProvider: FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, isLoading, refetch: refetchMe } = useGetMe();
  const loginMutation = useLoginUser();
  const logoutMutation = useLogoutUser();
  const createUserMutation = useCreateUser();

  const isAuthenticated = !!user;

  const isPrivateRoute = !location.pathname.startsWith('/auth');

  async function reloadUser() {
    await refetchMe();
  }

  const createUser = async (username: string, email: string) => {
    return await createUserMutation
      .mutateAsync({ username, email })
      .catch(() => {
        throw new Error('Email and Username must be unique');
      });
  };

  const login = async (email: string) => {
    return loginMutation.mutateAsync(email).catch(() => {
      throw new Error('Invalid login');
    });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync().then(() => {
      reloadUser();
      navigate({ to: '/auth/login' });
    });
  };

  useEffect(() => {
    if (!isAuthenticated && isPrivateRoute) {
      navigate({ to: '/auth/login' });
    }
  }, [isAuthenticated]);

  const contextData: AuthContextType = {
    user,
    isAuthenticated,
    createUser,
    login,
    logout,
    reloadUser,
    isLoading,
  };

  return (
    <AuthProviderContext.Provider value={contextData}>
      {children}
    </AuthProviderContext.Provider>
  );
};
