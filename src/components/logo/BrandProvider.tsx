import { createContext, useContext, useEffect, useRef, useState } from 'react';
import LogoIcon from './LogoIcon';
import { useLogoTheme } from './useLogoTheme';
import type { FC, ReactNode } from 'react';

const LogoUrlContext = createContext<string | undefined>(undefined);

/** The current logo icon as an SVG data URL, for places that need an image URL */
export const useLogoIconUrl = () => useContext(LogoUrlContext);

function setTabIcon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link#app-icon');
  if (!link) {
    link = document.createElement('link');
    link.id = 'app-icon';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    // After the static favicon.ico link, so browsers prefer this one
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Renders the themed logo once, offscreen, and hands its SVG to the browser
 * tab icon and to anything that asks via useLogoIconUrl (the Clerk cards).
 */
export const BrandProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const theme = useLogoTheme();
  const iconRef = useRef<SVGSVGElement>(null);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!iconRef.current) return;
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconRef.current.outerHTML)}`;
    setTabIcon(href);
    setUrl(href);
  }, [theme]);

  return (
    <LogoUrlContext.Provider value={url}>
      <div hidden>
        <LogoIcon ref={iconRef} theme={theme} size={64} />
      </div>
      {children}
    </LogoUrlContext.Provider>
  );
};
