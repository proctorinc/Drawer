import { createContext, useContext, type FC, type ReactNode } from 'react';
import type { GetMeResponse } from '@/api/Api';
import { useGetMyProfile } from '@/api/Api';
import LoadingScreen from '@/components/LoadingScreen';

type MyProfilePageContextType = {
  profile?: GetMeResponse;
  isLoading: boolean;
};

const MyProfilePageContext = createContext<
  MyProfilePageContextType | undefined
>(undefined);

type Props = {
  children: ReactNode;
};

export const MyProfilePageProvider: FC<Props> = ({ children }) => {
  const { data: profile, isLoading } = useGetMyProfile();

  const contextData: MyProfilePageContextType = {
    profile,
    isLoading,
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
