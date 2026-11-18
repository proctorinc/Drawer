import { createContext, useContext, type FC, type ReactNode } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { GetMeResponse } from '@/api/Api';
import { useGetUserProfile } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

type UserProfileContextType = {
  userProfile?: GetMeResponse;
  reloadUser: () => Promise<void>;
  isLoading: boolean;
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
    refetch: refetchUserProfile,
  } = useGetUserProfile(userId);
  const navigate = useNavigate();

  async function reloadUser() {
    await refetchUserProfile();
  }

  if (userId === currentUser.id) {
    navigate({ to: '/draw/profile/me' });
  }

  const contextData: UserProfileContextType = {
    userProfile: data,
    reloadUser,
    isLoading,
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
