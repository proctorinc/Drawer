import { Config } from '@/config/Config';
import type { FC, ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden">
      {children}
      <h1 className="text-sm mt-20 font-cursive tracking-widest text-secondary">
        {Config.APP_NAME}
      </h1>
    </div>
  );
};

export default Layout;
