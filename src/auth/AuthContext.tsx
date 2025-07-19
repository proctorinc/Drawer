import { createContext, type FC, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
  isFetching: boolean;
};

export const AuthProviderContext = createContext<AuthContextType | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

export const AuthProvider: FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const { data: user, isLoading, isFetching, refetch: refetchMe } = useGetMe();
  const loginMutation = useLoginUser();
  const logoutMutation = useLogoutUser();
  const createUserMutation = useCreateUser();

  const isAuthenticated = !!user;

  async function reloadUser() {
    await refetchMe();
  }

  const createUser = async (username: string, email: string) => {
    return await createUserMutation.mutateAsync({ username, email });
  };

  const login = async (email: string) => {
    return loginMutation.mutateAsync(email);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync().then(() => {
      reloadUser();
      navigate({ to: '/auth/login' });
    });
  };

  const contextData: AuthContextType = {
    user,
    isAuthenticated,
    createUser,
    login,
    logout,
    reloadUser,
    isLoading,
    isFetching,
  };

  return (
    <AuthProviderContext.Provider value={contextData}>
      {children}
    </AuthProviderContext.Provider>
  );
};
