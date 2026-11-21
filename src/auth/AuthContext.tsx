import { createContext, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC, ReactNode } from 'react';
import type { User } from '@/api/Api';
import { useCreateUser, useGetMe, useLogoutUser } from '@/api/Api';
import { ProfileRequiredError, setAuthTokenGetter } from '@/api/apiClient';
import { nameToColor } from '@/utils';

type AuthContextType = {
  user?: User;
  isAuthenticated: boolean;
  isSignedIn: boolean;
  needsProfile: boolean;
  createUser: (username: string) => Promise<void>;
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
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  // Set during render so it is in place before any child query runs
  setAuthTokenGetter(getToken);

  const {
    data: user,
    error,
    isLoading,
    isFetching,
    refetch: refetchMe,
  } = useGetMe(!!isSignedIn);
  const logoutMutation = useLogoutUser();
  const createUserMutation = useCreateUser();

  // The app's accent (progress fills, highlights, active tabs) is your own
  // profile color, the same one behind your avatar
  const username = user?.username;
  useEffect(() => {
    const root = document.documentElement.style;
    if (username) {
      const color = nameToColor(username);
      root.setProperty('--color-me', color.primary);
      root.setProperty('--color-me-ink', color.text);
    } else {
      root.removeProperty('--color-me');
      root.removeProperty('--color-me-ink');
    }
  }, [username]);

  const isAuthenticated = !!isSignedIn && !!user;
  const needsProfile = !!isSignedIn && error instanceof ProfileRequiredError;

  async function reloadUser() {
    await refetchMe();
  }

  const createUser = async (username: string) => {
    await createUserMutation.mutateAsync(username);
    await reloadUser();
  };

  const logout = async () => {
    try {
      // Clears any admin impersonation while the Clerk session is still valid
      await logoutMutation.mutateAsync();
    } finally {
      await signOut();
      queryClient.clear();
      navigate({ to: '/auth/login' });
    }
  };

  const contextData: AuthContextType = {
    user,
    isAuthenticated,
    isSignedIn: !!isSignedIn,
    needsProfile,
    createUser,
    logout,
    reloadUser,
    isLoading: !isLoaded || isLoading,
    isFetching: !isLoaded || isFetching,
  };

  return (
    <AuthProviderContext.Provider value={contextData}>
      {children}
    </AuthProviderContext.Provider>
  );
};
