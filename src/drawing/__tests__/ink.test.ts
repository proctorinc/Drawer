import { describe, expect, it } from 'vitest';
import { BARELY_DRAWN, inkLength } from '../ink';
import { Path } from '../shapes/Path';

const line = (length: number, isEraser = false) =>
  new Path(
    [
      { x: 0, y: 0 },
      { x: length, y: 0 },
    ],
    '#000',
    20,
    isEraser,
  );
const dot = () => new Path([{ x: 50, y: 50 }], '#000', 20);

describe('inkLength', () => {
  it('adds up every stroke, and a tap counts as its dot', () => {
    expect(inkLength([line(30), line(40), dot()])).toBe(90);
  });

  it('leaves out the eraser', () => {
    expect(inkLength([line(30), line(500, true)])).toBe(30);
  });

  it('calls a stray tap or scratch barely drawn, but not a real line', () => {
    expect(inkLength([dot()])).toBeLessThan(BARELY_DRAWN);
    expect(inkLength([line(60)])).toBeLessThan(BARELY_DRAWN);
    expect(inkLength([line(200)])).toBeGreaterThanOrEqual(BARELY_DRAWN);
  });
});
