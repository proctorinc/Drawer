import { createContext, useContext } from 'react';

/**
 * Where full-screen celebrations render. In the app that's document.body; the
 * admin's phone preview swaps in its own frame so they play inside it (the
 * frame is a size container with a transform, so position:fixed and cq units
 * resolve against the phone, not the desktop window).
 */
const StageHostContext = createContext<HTMLElement | null>(null);

export const StageHostProvider = StageHostContext.Provider;

/** The element to portal into, and whether it's a preview (don't touch the page) */
export function useStageHost(): { host: HTMLElement; preview: boolean } {
  const host = useContext(StageHostContext);
  return { host: host ?? document.body, preview: !!host };
}
