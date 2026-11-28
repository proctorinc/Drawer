import { Config } from '@/config/Config';

/** The stickers the app knows how to draw (the server keeps the same list) */
export const STICKERS = {
  bubble: {
    label: 'word bubble',
    /** Height for each unit of width */
    aspect: 0.7,
    /** How wide it starts unless an admin says otherwise, as a percent of the canvas */
    defaultSize: 45,
  },
  'googly-eyes': { label: 'googly eyes', aspect: 0.48, defaultSize: 30 },
} as const;

export type StickerKind = keyof typeof STICKERS;

export const STICKER_KINDS = Object.keys(STICKERS) as Array<StickerKind>;

export const isStickerKind = (kind: string): kind is StickerKind =>
  kind in STICKERS;

/** The sticker a prompt hands out, and how wide it starts as a percent of the canvas */
export type PromptSticker = { kind: StickerKind; size: number };

/** What admins can pick for a sticker's starting size (the server allows the same) */
export const MIN_STICKER_SIZE = 10;
export const MAX_STICKER_SIZE = 90;

/** Players can shrink or grow a sticker this far from where it started */
export const PLAYER_SCALE = { min: 0.5, max: 1.6 };

/** All a word bubble has room for: a tiny bit of context, not a caption */
export const BUBBLE_MAX_CHARS = 32;

/** A sticker on the page, in drawing units */
export type PlacedSticker = {
  kind: StickerKind;
  /** Its top-left corner */
  x: number;
  y: number;
  width: number;
  /** A word bubble's tail points right instead of left */
  flipped: boolean;
  /** What a word bubble says */
  text: string;
};

const CANVAS_W = Config.CANVAS_WIDTH;
const CANVAS_H = Config.CANVAS_HEIGHT;

export const stickerHeight = ({
  kind,
  width,
}: Pick<PlacedSticker, 'kind' | 'width'>) => width * STICKERS[kind].aspect;

/** How wide the prompt's sticker starts, in drawing units */
const startWidth = ({ size }: PromptSticker) => (size / 100) * CANVAS_W;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Keeps a sticker within what a player can do with it: no smaller or bigger
 * than they're allowed to make it, and all of it on the page.
 */
export function clampSticker(
  placed: PlacedSticker,
  sticker: PromptSticker,
): PlacedSticker {
  const start = startWidth(sticker);
  const aspect = STICKERS[placed.kind].aspect;
  const width = clamp(
    placed.width,
    start * PLAYER_SCALE.min,
    // Never so big it can't fit on the page
    Math.min(start * PLAYER_SCALE.max, CANVAS_W, CANVAS_H / aspect),
  );
  const height = width * aspect;
  return {
    ...placed,
    width,
    x: clamp(placed.x, 0, CANVAS_W - width),
    y: clamp(placed.y, 0, CANVAS_H - height),
    text: placed.text.slice(0, BUBBLE_MAX_CHARS),
  };
}

/** The prompt's sticker, freshly stuck in the middle of the page */
export function placeSticker(sticker: PromptSticker): PlacedSticker {
  const width = startWidth(sticker);
  return clampSticker(
    {
      kind: sticker.kind,
      x: (CANVAS_W - width) / 2,
      y: (CANVAS_H - stickerHeight({ kind: sticker.kind, width })) / 2,
      width,
      flipped: false,
      text: '',
    },
    sticker,
  );
}

/** The same sticker at a new starting size, kept where its middle was */
export function resizeSticker(
  placed: PlacedSticker,
  sticker: PromptSticker,
): PlacedSticker {
  const width = startWidth(sticker);
  const centerX = placed.x + placed.width / 2;
  const centerY = placed.y + stickerHeight(placed) / 2;
  return clampSticker(
    {
      ...placed,
      width,
      x: centerX - width / 2,
      y: centerY - stickerHeight({ kind: placed.kind, width }) / 2,
    },
    sticker,
  );
}
