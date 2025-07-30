import { createContext, useContext, type FC, type ReactNode } from 'react';
import type { AchievementsAndRewardsResponse, GetMeResponse } from '@/api/Api';
import {
  queryKeys,
  useGetAchievements,
  useGetMyProfile,
  useToggleAvatarType,
  useUploadCustomAvatar,
} from '@/api/Api';
import LoadingScreen from '@/components/LoadingScreen';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

type MyProfilePageContextType = {
  profile?: GetMeResponse;
  achievementsData?: AchievementsAndRewardsResponse;
  isLoading: boolean;
  toggleAvatar: () => void;
  uploadAvatar: (png: Blob) => void;
  customAvatarIsUnlocked?: boolean;
};

const MyProfilePageContext = createContext<
  MyProfilePageContextType | undefined
>(undefined);

type Props = {
  children: ReactNode;
};

export const MyProfilePageProvider: FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { data: achievementsData, isLoading: achievementsLoading } =
    useGetAchievements();
  const toggleAvatarMutation = useToggleAvatarType();
  const uploadAvatarMutation = useUploadCustomAvatar();
  const customAvatarIsUnlocked =
    !!achievementsData?.rewards.has('CUSTOM_PROFILE_PIC');

  const toggleAvatar = () => {
    toggleAvatarMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      },
    });
  };

  const uploadAvatar = (image: Blob) => {
    uploadAvatarMutation.mutate(image, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        navigate({ to: '/draw/profile/me' });
      },
    });
  };

  const contextData: MyProfilePageContextType = {
    profile,
    achievementsData,
    toggleAvatar,
    uploadAvatar,
    isLoading: profileLoading || achievementsLoading,
    customAvatarIsUnlocked,
  };

  return (
    <MyProfilePageContext.Provider value={contextData}>
      {profile === undefined ? <LoadingScreen /> : children}
    </MyProfilePageContext.Provider>
  );
};

export const useMyProfilePage = (): MyProfilePageContextType => {
  const context = useContext(MyProfilePageContext);

  if (!context) {
    throw new Error(
      'useMyProfilePage must be used within a MyProfilePageProvider',
    );
  }

  return context;
};
