import Navbar from './Navbar';
import Masthead from './Masthead';
import type { FC, ReactNode } from 'react';
import useAuth from '@/auth/hooks/useAuth';

type Props = {
  /** Page-specific block rendered between the masthead and the content */
  header?: ReactNode;
  back?: boolean;
  /** Right side of the masthead's date line */
  aside?: ReactNode;
  children: ReactNode;
};

const Layout: FC<Props> = ({ header, back, aside, children }) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="paper flex justify-center min-h-dvh overflow-x-clip">
      <div className="flex flex-col w-full max-w-md">
        <Masthead back={back} aside={aside} />
        {header && <div className="px-6 pt-5 animate-rise">{header}</div>}
        <main className="flex flex-col flex-grow items-center gap-6 px-6 pt-5 pb-36 animate-rise [animation-delay:60ms]">
          {children}
        </main>
      </div>
      {isAuthenticated && <Navbar />}
    </div>
  );
};

export default Layout;
