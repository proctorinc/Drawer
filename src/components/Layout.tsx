import type { FC, ReactNode } from 'react';
import Navbar from './Navbar';
import Header from './Header';

type Props = {
  children: ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex justify-center">
      <div className="relative flex flex-col flex-grow items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md">
        <Header />
        {children}
        <Navbar />
      </div>
    </div>
  );
};

export default Layout;
