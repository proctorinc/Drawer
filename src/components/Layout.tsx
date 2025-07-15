import type { FC, ReactNode } from 'react';
import Navbar from './Navbar';
import Header from './Header';
import useAuth from '@/auth/hooks/useAuth';

type Props = {
  header?: ReactNode;
  children: ReactNode;
};

const Layout: FC<Props> = ({ header, children }) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className=" flex flex-col items-center justify-center">
      <div className="-z-10 sticky top-0 flex flex-col items-center max-w-md w-full gap-6 md:p-2">
        <Header />
        {header}
      </div>
      <div className="z-0 relative flex flex-col flex-grow w-full items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md rounded-t-3xl border-2 border-border">
        {children}
        {isAuthenticated && <Navbar />}
      </div>
    </div>
  );
};

export default Layout;
