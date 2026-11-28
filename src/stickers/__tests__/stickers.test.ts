import { describe, expect, it } from 'vitest';
import {
  BUBBLE_MAX_CHARS,
  clampSticker,
  placeSticker,
  resizeSticker,
  stickerHeight,
} from '../stickers';
import { flick, isSettled, loosePupil, stepPupil } from '../googly';
import { wrapText } from '../paint';
import { Config } from '@/config/Config';

const W = Config.CANVAS_WIDTH;
const bubble = { kind: 'bubble', size: 40 } as const;

describe('placing a sticker', () => {
  it('starts in the middle of the page at the size the prompt gives', () => {
    const placed = placeSticker(bubble);
    expect(placed.width).toBeCloseTo(W * 0.4);
    expect(placed.x + placed.width / 2).toBeCloseTo(W / 2);
    expect(placed.y + stickerHeight(placed) / 2).toBeCloseTo(
      Config.CANVAS_HEIGHT / 2,
    );
  });

  it('stays on the page and within what a player can resize it to', () => {
    const placed = placeSticker(bubble);
    const dragged = clampSticker({ ...placed, x: -50, y: 9999 }, bubble);
    expect(dragged.x).toBe(0);
    expect(dragged.y + stickerHeight(dragged)).toBeCloseTo(
      Config.CANVAS_HEIGHT,
    );
    expect(clampSticker({ ...placed, width: 1 }, bubble).width).toBeCloseTo(
      W * 0.2,
    );
    expect(clampSticker({ ...placed, width: 999 }, bubble).width).toBeCloseTo(
      W * 0.64,
    );
  });

  it('never grows bigger than the page, whatever the prompt allows', () => {
    const huge = { kind: 'bubble', size: 90 } as const;
    expect(
      clampSticker({ ...placeSticker(huge), width: 999 }, huge).width,
    ).toBe(W);
  });

  it('cuts a bubble off at its limit', () => {
    const text = 'x'.repeat(BUBBLE_MAX_CHARS + 10);
    expect(clampSticker({ ...placeSticker(bubble), text }, bubble).text).toBe(
      'x'.repeat(BUBBLE_MAX_CHARS),
    );
  });

  it('keeps its middle when an admin tries another size', () => {
    const placed = { ...placeSticker(bubble), x: 110, y: 120 };
    const bigger = resizeSticker(placed, { kind: 'bubble', size: 60 });
    expect(bigger.width).toBeCloseTo(W * 0.6);
    expect(bigger.x + bigger.width / 2).toBeCloseTo(
      placed.x + placed.width / 2,
    );
  });
});

describe('googly eye pupils', () => {
  const run = (pupil = loosePupil(() => 0.3), seconds = 4) => {
    let p = pupil;
    for (let t = 0; t < seconds; t += 1 / 60) p = stepPupil(p, 1 / 60);
    return p;
  };

  it('fall to the bottom and settle', () => {
    const settled = run();
    expect(isSettled(settled)).toBe(true);
    expect(Math.abs(settled.x)).toBeLessThan(0.02);
  });

  it('never leave the eye, however hard they are thrown', () => {
    let p = loosePupil(() => 0.5);
    for (let i = 0; i < 300; i++) {
      p = stepPupil(p, 1 / 60, i % 20 < 10 ? 500 : -500, 300);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.41 + 1e-9);
    }
  });

  it('swing towards where the eye came from when it is pulled', () => {
    const resting = run();
    const pulled = stepPupil(resting, 1 / 60, 300, 0);
    expect(pulled.vx).toBeLessThan(0);
  });

  it('come back to rest after a flick', () => {
    const flicked = flick(run(), () => 0.25);
    expect(isSettled(flicked)).toBe(false);
    expect(isSettled(run(flicked))).toBe(true);
  });
});

describe('wrapping a bubble', () => {
  // Every letter one unit wide
  const measure = (text: string) => text.length;

  it('fills lines a word at a time', () => {
    expect(wrapText('so much  for that', 8, measure)).toEqual([
      'so much',
      'for that',
    ]);
  });

  it('breaks a word too long for any line', () => {
    expect(wrapText('aaaaaaaaaa b', 4, measure)).toEqual([
      'aaaa',
      'aaaa',
      'aa b',
    ]);
  });
});
