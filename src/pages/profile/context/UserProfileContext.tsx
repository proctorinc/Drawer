import { createContext, useContext } from 'react';
import { Navigate, useParams } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { useGetUserProfile } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

type UserProfileContextType = {
  userProfile?: GetMeResponse;
  reloadUser: () => Promise<void>;
  isLoading: boolean;
  /** True when there's no such user, or they couldn't be loaded */
  isError: boolean;
};

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined,
);

type Props = {
  children: ReactNode;
};

export const UserProfileProvider: FC<Props> = ({ children }) => {
  const currentUser = useUser();
  const { userId } = useParams({ from: '/draw/profile/$userId' });
  const {
    data,
    isLoading,
    isError,
    refetch: refetchUserProfile,
  } = useGetUserProfile(userId);

  async function reloadUser() {
    await refetchUserProfile();
  }

  if (userId === currentUser.id) {
    return <Navigate to="/draw/profile/me" replace />;
  }

  const contextData: UserProfileContextType = {
    userProfile: data,
    reloadUser,
    isLoading,
    isError,
  };

  return (
    <UserProfileContext.Provider value={contextData}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useProfile = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a UserProfileProvider');
  }
  return context;
};
