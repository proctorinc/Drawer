import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignaturePad } from '../Signature';

// jsdom has no PointerEvent, and without one the coordinates are dropped
if (!('PointerEvent' in window)) {
  Object.assign(window, { PointerEvent: MouseEvent });
}

// The pad is drawn at 2× its 240×80 box, so screen points halve into path points
function renderPad(path = '') {
  const onChange = vi.fn();
  render(<SignaturePad path={path} onChange={onChange} />);
  const pad = screen.getByRole('img', { name: 'signature pad' });
  pad.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 480, height: 160 }) as DOMRect;
  pad.setPointerCapture = () => {};
  return { pad, onChange };
}

function stroke(pad: Element, points: Array<[number, number]>) {
  const [[x, y], ...rest] = points;
  fireEvent.pointerDown(pad, { clientX: x, clientY: y, pointerId: 1 });
  for (const [mx, my] of rest) {
    fireEvent.pointerMove(pad, { clientX: mx, clientY: my, pointerId: 1 });
  }
  fireEvent.pointerUp(pad, { pointerId: 1 });
}

describe('SignaturePad', () => {
  it('turns a stroke into a curve through its midpoints', () => {
    const { pad, onChange } = renderPad();
    stroke(pad, [
      [0, 0],
      [20, 40],
      [60, 40],
      [100, 0],
    ]);
    expect(onChange).toHaveBeenCalledWith(
      'M0,0 Q10,20 20,20 Q30,20 40,10 L50,0',
    );
  });

  it('turns a tap into a dot', () => {
    const { pad, onChange } = renderPad();
    stroke(pad, [[40, 40]]);
    expect(onChange).toHaveBeenCalledWith('M20,20 l0 0.1');
  });

  it('adds each new stroke to the signature so far', () => {
    const { pad, onChange } = renderPad('M0,0 L5,5');
    stroke(pad, [[40, 40]]);
    expect(onChange).toHaveBeenCalledWith('M0,0 L5,5 M20,20 l0 0.1');
  });
});
