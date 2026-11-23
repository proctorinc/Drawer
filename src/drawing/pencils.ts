import { Config } from '@/config/Config';

/** One color a prompt hands out, and how thick it draws (in drawing units) */
export type Pencil = {
  color: string;
  size: number;
};

/** What every pencil drew before prompts could pick their own */
export const DEFAULT_PENCIL_SIZE = Config.CURSOR_SIZE;

/** How many pencils a prompt gets when it doesn't pick its own */
export const DEFAULT_PENCIL_COUNT = 3;

/** Sizes an admin can pick from, thinnest first */
export const PENCIL_SIZES: Array<{ label: string; size: number }> = [
  { label: 'fine', size: 6 },
  { label: 'thin', size: 12 },
  { label: 'regular', size: DEFAULT_PENCIL_SIZE },
  { label: 'thick', size: 32 },
];

export const defaultPencils = (colors: Array<string>): Array<Pencil> =>
  colors
    .slice(0, DEFAULT_PENCIL_COUNT)
    .map((color) => ({ color, size: DEFAULT_PENCIL_SIZE }));

/**
 * The pencils a prompt hands out: its own, or the usual three (its first
 * three colors, at the regular size). A fourth color is the paper, not a pencil.
 */
export const pencilsFor = (prompt: {
  colors: Array<string>;
  pencils?: Array<Pencil> | null;
}): Array<Pencil> =>
  prompt.pencils?.length ? prompt.pencils : defaultPencils(prompt.colors);

/** Whether these are just the usual three, so there's nothing to store */
export const isDefaultPencils = (
  pencils: Array<Pencil>,
  colors: Array<string>,
) => {
  const usual = defaultPencils(colors);
  return (
    pencils.length === usual.length &&
    pencils.every(
      (p, i) => p.color === usual[i].color && p.size === usual[i].size,
    )
  );
};

/**
 * How big a pencil's button is next to a regular one's. Not to scale: thin
 * pencils get much smaller buttons, thick ones a little bigger.
 */
export const pencilButtonScale = (size: number) =>
  Math.min(1.2, Math.max(0.5, Math.sqrt(size / DEFAULT_PENCIL_SIZE)));
