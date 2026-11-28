import { describe, expect, it } from 'vitest';
import { BARELY_DRAWN, inkLength, whyUnfinished } from '../ink';
import { Path } from '../shapes/Path';

const line = (length: number, color = '#000', isEraser = false) =>
  new Path(
    [
      { x: 0, y: 0 },
      { x: length, y: 0 },
    ],
    color,
    20,
    isEraser,
  );
const dot = () => new Path([{ x: 50, y: 50 }], '#000', 20);

describe('inkLength', () => {
  it('adds up every stroke, and a tap counts as its dot', () => {
    expect(inkLength([line(30), line(40), dot()])).toBe(90);
  });

  it('leaves out the eraser', () => {
    expect(inkLength([line(30), line(500, '#000', true)])).toBe(30);
  });
});

describe('whyUnfinished', () => {
  const pencils = ['red', 'green', 'gold'];
  const third = BARELY_DRAWN / 3;

  it('calls too little ink barely drawn, even with every pencil used', () => {
    const paths = [line(100, 'red'), line(100, 'green'), line(100, 'gold')];
    expect(whyUnfinished(paths, pencils)).toBe('barely-drawn');
  });

  it('wants every pencil used at least once', () => {
    const paths = [line(BARELY_DRAWN, 'red'), line(10, 'green')];
    expect(whyUnfinished(paths, pencils)).toBe('unused-pencil');
  });

  it("doesn't count the eraser as a pencil", () => {
    const paths = [
      line(BARELY_DRAWN, 'red'),
      line(10, 'green'),
      line(10, 'gold', true),
    ];
    expect(whyUnfinished(paths, pencils)).toBe('unused-pencil');
  });

  it('passes enough ink in every color', () => {
    const paths = pencils.map((color) => line(third, color));
    expect(whyUnfinished(paths, pencils)).toBeNull();
  });
});
