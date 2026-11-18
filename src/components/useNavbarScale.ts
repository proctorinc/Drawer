import { useEffect, useState } from 'react';

/** The bar's full height, raised draw button and seasonal decorations included */
const FULL_HEIGHT = 110;
/** The most of the screen's height the bar may cover */
const MAX_SHARE = 0.16;

const scaleFor = (viewportHeight: number) =>
  Math.min(1, (viewportHeight * MAX_SHARE) / FULL_HEIGHT);

/**
 * How much to shrink the navbar so it never grows past a set share of the
 * screen. Zooming the page in shrinks the viewport in CSS pixels, so the bar
 * shrinks to match and stays the same size on screen; at normal zoom on a
 * phone it is 1.
 */
export function useNavbarScale() {
  const [scale, setScale] = useState(() => scaleFor(window.innerHeight));

  useEffect(() => {
    const update = () => setScale(scaleFor(window.innerHeight));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}
