import { createPortal } from 'react-dom';
import { useShell, useShellConfig } from './AppShell';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  /** Page-specific block rendered between the masthead and the content */
  header?: ReactNode;
  /** Swap the masthead's logo for a back button */
  back?: boolean;
  /**
   * Replaces the app masthead for this page. The default masthead stays
   * mounted in `AppShell` and comes back when the page leaves.
   */
  masthead?: ReactNode;
  /** Hide the navbar for this page, e.g. a game that needs the whole screen */
  noNavbar?: boolean;
  children: ReactNode;
};

/**
 * A page inside `AppShell`. The masthead and navbar live in the shell and
 * persist across navigation; this renders only the page's own content and
 * tells the shell how to dress the masthead for it.
 */
const Layout: FC<Props> = ({
  header,
  back,
  masthead,
  noNavbar = false,
  children,
}) => {
  const shell = useShell();
  const hasMasthead = masthead !== undefined;
  useShellConfig({ back: !!back, customMasthead: hasMasthead, noNavbar });

  return (
    <>
      {hasMasthead &&
        shell?.mastheadSlot &&
        createPortal(masthead, shell.mastheadSlot)}
      {header && <div className="px-6 pt-5 animate-rise">{header}</div>}
      <main
        className={cn(
          'flex flex-col flex-grow items-center gap-6 px-6 pt-5 animate-rise [animation-delay:60ms]',
          // Room for the navbar floating over the bottom
          noNavbar ? 'pb-[max(1.5rem,env(safe-area-inset-bottom))]' : 'pb-36',
        )}
      >
        {children}
      </main>
    </>
  );
};

export default Layout;
