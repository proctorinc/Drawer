import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Outlet } from '@tanstack/react-router';
import Navbar from './Navbar';
import Masthead from './Masthead';
import type { FC } from 'react';
import useAuth from '@/auth/hooks/useAuth';
import { ChristmasIntroOnce } from '@/events/christmas/ChristmasIntro';
import Lights from '@/events/christmas/Lights';
import Snowfall from '@/events/christmas/Snowfall';
import { useChristmas } from '@/events/useChristmas';

/** What the current page wants from the app's chrome */
export type ShellConfig = {
  /** Swap the masthead's logo for a back button */
  back: boolean;
  /** The page portals its own masthead into the shell's slot */
  customMasthead: boolean;
  /** Hide the masthead and navbar (they stay mounted) for full-screen pages */
  fullscreen: boolean;
};

const DEFAULT_CONFIG: ShellConfig = {
  back: false,
  customMasthead: false,
  fullscreen: false,
};

type ShellContextValue = {
  configure: (config: ShellConfig) => () => void;
  /** Where a page's custom masthead is portalled to */
  mastheadSlot: HTMLElement | null;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export const useShell = () => useContext(ShellContext);

/**
 * Applies `config` to the shell while the calling page is mounted. Pages only
 * render inside the shell, so the outgoing page's reset and the incoming
 * page's config land in the same commit and the masthead never flickers.
 */
export const useShellConfig = (config: Partial<ShellConfig>) => {
  const shell = useShell();
  const { back, customMasthead, fullscreen } = { ...DEFAULT_CONFIG, ...config };

  useLayoutEffect(
    () => shell?.configure({ back, customMasthead, fullscreen }),
    [shell, back, customMasthead, fullscreen],
  );
};

/** Hides the masthead and navbar while the calling component is mounted */
export const useFullscreenPage = (fullscreen = true) =>
  useShellConfig({ fullscreen });

/**
 * The persistent frame around every app page: the masthead and navbar mount
 * once here and stay put across navigation. Pages render into the outlet
 * through `Layout`, which tells the shell how to dress the masthead.
 */
const AppShell: FC = () => {
  const { isAuthenticated } = useAuth();
  const christmas = useChristmas();
  const [config, setConfig] = useState<ShellConfig>(DEFAULT_CONFIG);
  const [mastheadSlot, setMastheadSlot] = useState<HTMLElement | null>(null);

  const configure = useCallback((next: ShellConfig) => {
    setConfig(next);
    return () => setConfig(DEFAULT_CONFIG);
  }, []);

  const value = useMemo(
    () => ({ configure, mastheadSlot }),
    [configure, mastheadSlot],
  );

  // `contents` keeps the wrappers out of the layout; `hidden` keeps the
  // masthead and navbar mounted while a full-screen page is up
  const chromeClass = config.fullscreen ? 'hidden' : 'contents';

  return (
    <ShellContext.Provider value={value}>
      <div className="paper flex justify-center min-h-dvh overflow-x-clip">
        {christmas && <Snowfall />}
        {/* relative so the page paints over the snow */}
        <div className="relative flex flex-col w-full max-w-md">
          <div className={chromeClass}>
            {!config.customMasthead && <Masthead back={config.back} />}
            <div ref={setMastheadSlot} className="contents" />
            {christmas && <Lights className="-mt-1.5 -mb-3" />}
          </div>
          <Outlet />
        </div>
        {isAuthenticated && (
          <div className={chromeClass}>
            <Navbar />
          </div>
        )}
        <ChristmasIntroOnce />
      </div>
    </ShellContext.Provider>
  );
};

export default AppShell;
