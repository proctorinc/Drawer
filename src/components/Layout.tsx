import { createPortal } from 'react-dom';
import { useShell, useShellConfig } from './AppShell';
import type { FC, ReactNode } from 'react';

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
  children: ReactNode;
};

/**
 * A page inside `AppShell`. The masthead and navbar live in the shell and
 * persist across navigation; this renders only the page's own content and
 * tells the shell how to dress the masthead for it.
 */
const Layout: FC<Props> = ({ header, back, masthead, children }) => {
  const shell = useShell();
  const hasMasthead = masthead !== undefined;
  useShellConfig({ back: !!back, customMasthead: hasMasthead });

  return (
    <>
      {hasMasthead &&
        shell?.mastheadSlot &&
        createPortal(masthead, shell.mastheadSlot)}
      {header && <div className="px-6 pt-5 animate-rise">{header}</div>}
      <main className="flex flex-col flex-grow items-center gap-6 px-6 pt-5 pb-36 animate-rise [animation-delay:60ms]">
        {children}
      </main>
    </>
  );
};

export default Layout;
