import Navbar from './Navbar';
import Masthead from './Masthead';
import type { FC, ReactNode } from 'react';
import useAuth from '@/auth/hooks/useAuth';
import { ChristmasIntroOnce } from '@/events/christmas/ChristmasIntro';
import Lights from '@/events/christmas/Lights';
import Snowfall from '@/events/christmas/Snowfall';
import { useChristmas } from '@/events/useChristmas';

type Props = {
  /** Page-specific block rendered between the masthead and the content */
  header?: ReactNode;
  back?: boolean;
  children: ReactNode;
};

const Layout: FC<Props> = ({ header, back, children }) => {
  const { isAuthenticated } = useAuth();
  const christmas = useChristmas();

  return (
    <div className="paper flex justify-center min-h-dvh overflow-x-clip">
      {christmas && <Snowfall />}
      {/* relative so the page paints over the snow */}
      <div className="relative flex flex-col w-full max-w-md">
        <Masthead back={back} />
        {christmas && <Lights className="-mt-1.5 -mb-3" />}
        {header && <div className="px-6 pt-5 animate-rise">{header}</div>}
        <main className="flex flex-col flex-grow items-center gap-6 px-6 pt-5 pb-36 animate-rise [animation-delay:60ms]">
          {children}
        </main>
      </div>
      {isAuthenticated && <Navbar />}
      <ChristmasIntroOnce />
    </div>
  );
};

export default Layout;
