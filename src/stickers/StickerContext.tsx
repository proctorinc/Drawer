import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { loosePupil } from './googly';
import { loadStickerFonts, paintSticker } from './paint';
import {
  clampSticker,
  isStickerKind,
  placeSticker,
  resizeSticker,
} from './stickers';
import type { FC, ReactNode, RefObject } from 'react';
import type { Pupil } from './googly';
import type { PlacedSticker, PromptSticker } from './stickers';

type StickerContextType = {
  /** The sticker the prompt hands out, or null for none (or one this app can't draw) */
  sticker: PromptSticker | null;
  /** The sticker on the page, or null until it's added */
  placed: PlacedSticker | null;
  /** Being moved and edited: the toolbar swaps for its controls */
  selected: boolean;
  add: () => void;
  remove: () => void;
  select: () => void;
  deselect: () => void;
  /** Moves, resizes or edits the sticker, kept within what a player may do */
  update: (change: Partial<PlacedSticker>) => void;
  /** Where the googly eyes' pupils are right now, for painting and pinning */
  pupils: RefObject<Array<Pupil>>;
  /** Goes up with each shake of the googly eyes */
  jiggles: number;
  jiggle: () => void;
  /** Paints the sticker onto the picture being pinned (the context draws in drawing units) */
  paintOver: (ctx: CanvasRenderingContext2D) => void;
};

const StickerContext = createContext<StickerContextType | null>(null);

function loadPlaced(
  key: string | undefined,
  sticker: PromptSticker | null,
): PlacedSticker | null {
  if (!key || !sticker) return null;
  try {
    const json = localStorage.getItem(key);
    if (!json) return null;
    const placed: PlacedSticker = JSON.parse(json);
    // The prompt's sticker changed since: start again
    if (placed.kind !== sticker.kind) return null;
    return clampSticker(placed, sticker);
  } catch {
    return null;
  }
}

function savePlaced(key: string | undefined, placed: PlacedSticker | null) {
  if (!key) return;
  try {
    if (placed) {
      localStorage.setItem(key, JSON.stringify(placed));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: the sticker just won't survive a reload
  }
}

type Props = {
  /** What the prompt hands out, straight from the server */
  sticker?: { kind: string; size: number; maxChars?: number } | null;
  /** Where the sticker is kept on the device until the drawing's pinned; nowhere if not given */
  storageKey?: string;
  children: ReactNode;
};

/** The prompt's sticker, from being added to the page until it's pinned with the drawing */
export const StickerProvider: FC<Props> = ({
  sticker: given,
  storageKey,
  children,
}) => {
  const kind = given && isStickerKind(given.kind) ? given.kind : null;
  const size = given?.size;
  const maxChars = given?.maxChars;
  const sticker = useMemo(
    () => (kind && size ? { kind, size, maxChars } : null),
    [kind, size, maxChars],
  );
  const [placed, setPlaced] = useState(() => loadPlaced(storageKey, sticker));
  const [selected, setSelected] = useState(false);
  const [jiggles, setJiggles] = useState(0);
  const pupils = useRef<Array<Pupil>>([loosePupil(), loosePupil()]);

  useEffect(() => savePlaced(storageKey, placed), [storageKey, placed]);

  // The words are painted on a canvas, which can't wait for the font
  useEffect(() => {
    if (kind === 'bubble') loadStickerFonts();
  }, [kind]);

  // A new size or letter limit (an admin trying them out) takes effect on the
  // sticker already down
  const stickerRef = useRef(sticker);
  useEffect(() => {
    const before = stickerRef.current;
    stickerRef.current = sticker;
    if (!sticker || before === sticker) return;
    const fit = before?.size === sticker.size ? clampSticker : resizeSticker;
    setPlaced((prev) =>
      prev?.kind === sticker.kind ? fit(prev, sticker) : null,
    );
  }, [sticker]);

  const add = useCallback(() => {
    if (!sticker) return;
    pupils.current = [loosePupil(), loosePupil()];
    setPlaced(placeSticker(sticker));
    setSelected(true);
  }, [sticker]);

  const remove = useCallback(() => {
    setPlaced(null);
    setSelected(false);
  }, []);

  const update = useCallback(
    (change: Partial<PlacedSticker>) => {
      if (!sticker) return;
      setPlaced((prev) =>
        prev ? clampSticker({ ...prev, ...change }, sticker) : prev,
      );
    },
    [sticker],
  );

  const paintOver = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (placed) paintSticker(ctx, placed, { pupils: pupils.current });
    },
    [placed],
  );

  const value = useMemo<StickerContextType>(
    () => ({
      sticker,
      placed,
      selected: selected && !!placed,
      add,
      remove,
      select: () => setSelected(true),
      deselect: () => setSelected(false),
      update,
      pupils,
      jiggles,
      jiggle: () => setJiggles((n) => n + 1),
      paintOver,
    }),
    [sticker, placed, selected, add, remove, update, jiggles, paintOver],
  );

  return (
    <StickerContext.Provider value={value}>{children}</StickerContext.Provider>
  );
};

export function useStickers(): StickerContextType {
  const context = useContext(StickerContext);
  if (!context) {
    throw new Error('useStickers must be used within a StickerProvider');
  }
  return context;
}
