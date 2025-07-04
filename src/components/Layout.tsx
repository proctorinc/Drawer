import type { FC, ReactNode } from 'react';
import Navbar from './Navbar';
import Header from './Header';

type Props = {
  children: ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <Header />
      <div className="relative flex flex-col flex-grow w-full items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md rounded-t-2xl border-2 border-border">
        {children}
        <Navbar />
      </div>
    </div>
  );
};

export default Layout;
