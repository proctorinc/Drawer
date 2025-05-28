import type { FC, ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col items-center p-6 md:p-2 mb-20 gap-4 bg-base min-h-screen overflow-y-auto">
      {children}
    </div>
  );
};

export default Layout;
