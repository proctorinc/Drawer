import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { edgesAt, usePinchZoom } from '../usePinchZoom';

const Frame = () => {
  const { frameRef } = usePinchZoom();
  return (
    <div ref={frameRef}>
      <div data-testid="content" />
    </div>
  );
};

/** The frame inside a bigger pinch area, with a toolbar beside it */
const Desk = () => {
  const deskRef = useRef<HTMLDivElement>(null);
  const { frameRef } = usePinchZoom(deskRef);
  return (
    <div ref={deskRef}>
      <div ref={frameRef}>
        <div data-testid="content" />
      </div>
      <div data-testid="toolbar" />
    </div>
  );
};

type Touch = { id: number; x: number; y: number; primary: boolean };
const touch = (
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  { id, x, y, primary }: Touch,
  on = 'content',
) =>
  fireEvent[type](screen.getByTestId(on), {
    pointerId: id,
    pointerType: 'touch',
    isPrimary: primary,
    clientX: x,
    clientY: y,
  });

describe('usePinchZoom', () => {
  beforeAll(() => {
    // jsdom has neither of these
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId: number;
        pointerType: string;
        isPrimary: boolean;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
          this.pointerType = init.pointerType ?? '';
          this.isPrimary = init.isPrimary ?? false;
        }
      },
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it('zooms when two fingers spread apart', () => {
    render(<Frame />);
    touch('pointerDown', { id: 1, x: 100, y: 100, primary: true });
    touch('pointerDown', { id: 2, x: 120, y: 120, primary: false });
    touch('pointerMove', { id: 2, x: 200, y: 200, primary: false });
    expect(screen.getByTestId('content').style.transform).toContain('scale');
  });

  it('zooms the canvas when the pinch is beside it, inside the area', () => {
    render(<Desk />);
    touch('pointerDown', { id: 1, x: 100, y: 500, primary: true }, 'toolbar');
    touch('pointerDown', { id: 2, x: 120, y: 520, primary: false }, 'toolbar');
    touch('pointerMove', { id: 2, x: 200, y: 600, primary: false }, 'toolbar');
    expect(screen.getByTestId('content').style.transform).toContain('scale');
  });

  it("doesn't zoom one finger when an earlier finger's lift never arrived", () => {
    render(<Frame />);
    // A finger lands and the system swallows its release
    touch('pointerDown', { id: 1, x: 100, y: 100, primary: true });
    // Later, an ordinary one-finger stroke
    touch('pointerDown', { id: 2, x: 120, y: 120, primary: true });
    touch('pointerMove', { id: 2, x: 200, y: 200, primary: true });
    touch('pointerUp', { id: 2, x: 200, y: 200, primary: true });
    expect(screen.getByTestId('content').style.transform).toBe('');
  });
});

describe('edgesAt', () => {
  const frame = { width: 300, height: 300 };
  const none = { top: false, right: false, bottom: false, left: false };

  it('marks no side when not zoomed', () => {
    expect(edgesAt({ scale: 1, x: 0, y: 0 }, frame)).toEqual(none);
  });

  it('marks no side zoomed into the middle', () => {
    expect(edgesAt({ scale: 2, x: -150, y: -150 }, frame)).toEqual(none);
  });

  it('marks the one side panned up against', () => {
    expect(edgesAt({ scale: 2, x: 0, y: -150 }, frame)).toEqual({
      ...none,
      left: true,
    });
  });

  it('marks both sides in a corner', () => {
    expect(edgesAt({ scale: 2, x: -300, y: -300 }, frame)).toEqual({
      ...none,
      right: true,
      bottom: true,
    });
  });
});
