import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import type {
  AchievementsAndRewardsResponse,
  CustomAvatar,
  GetMeResponse,
} from '@/api/Api';
import {
  queryKeys,
  useGetAchievements,
  useGetMyAvatars,
  useGetMyProfile,
  useToggleAvatarType,
  useUploadCustomAvatar,
  useWearAvatar,
} from '@/api/Api';
import LoadingScreen from '@/components/LoadingScreen';

type MyProfilePageContextType = {
  profile?: GetMeResponse;
  achievementsData?: AchievementsAndRewardsResponse;
  isLoading: boolean;
  toggleAvatar: () => void;
  /** Saves a drawing into a face slot, replacing what was there, and wears it */
  uploadAvatar: (png: Blob, slot: number) => void;
  /** Switches to a face already drawn in a slot */
  wearAvatar: (slot: number) => void;
  /** Your drawn faces, by slot */
  avatars?: Array<CustomAvatar>;
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
  const wearAvatarMutation = useWearAvatar();
  const customAvatarIsUnlocked =
    !!achievementsData?.rewards.has('CUSTOM_PROFILE_PIC');
  const { data: avatars } = useGetMyAvatars(customAvatarIsUnlocked);

  const refreshFaces = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    queryClient.invalidateQueries({ queryKey: queryKeys.myAvatars });
  };

  const toggleAvatar = () => {
    toggleAvatarMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      },
    });
  };

  const uploadAvatar = (image: Blob, slot: number) => {
    uploadAvatarMutation.mutate(
      { image, slot },
      {
        onSuccess: () => {
          refreshFaces();
          navigate({ to: '/draw/profile/me' });
        },
      },
    );
  };

  const wearAvatar = (slot: number) => {
    if (wearAvatarMutation.isPending) return;
    wearAvatarMutation.mutate(slot, { onSuccess: refreshFaces });
  };

  const contextData: MyProfilePageContextType = {
    profile,
    achievementsData,
    toggleAvatar,
    uploadAvatar,
    wearAvatar,
    avatars,
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
