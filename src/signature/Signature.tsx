import { useRef, useState } from 'react';
import type { FC, PointerEvent } from 'react';
import { cn } from '@/utils';

/**
 * A signature is one SVG path in a fixed 240×80 box: tiny to store and crisp
 * at any size, from the signing pad down to the corner of a polaroid.
 */
const WIDTH = 240;
const HEIGHT = 80;
const VIEW_BOX = `0 0 ${WIDTH} ${HEIGHT}`;

type Point = [number, number];

const round = (n: number) => Math.round(n * 10) / 10;
const mid = (a: Point, b: Point): Point => [
  round((a[0] + b[0]) / 2),
  round((a[1] + b[1]) / 2),
];

/** Curves through the midpoints so a shaky pointer still reads as a pen line */
function strokeToPath(points: Array<Point>): string {
  const [first, ...rest] = points;
  // A tap: a short line that the round cap turns into a dot
  if (rest.length === 0) return `M${first} l0 0.1`;
  const curves = rest
    .slice(0, -1)
    .map((point, i) => `Q${point} ${mid(point, rest[i + 1])}`);
  return [`M${first}`, ...curves, `L${rest[rest.length - 1]}`].join(' ');
}

/** A signature drawn in ink, with a paper halo so it reads on dark drawings */
export const SignatureMark: FC<{
  path: string;
  /** Ink width in screen pixels, whatever size it's drawn at */
  strokeWidth?: number;
  className?: string;
}> = ({ path, strokeWidth = 1.5, className }) => (
  <svg
    viewBox={VIEW_BOX}
    aria-hidden="true"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path
      d={path}
      stroke="white"
      strokeOpacity={0.85}
      strokeWidth={strokeWidth + 2.5}
      vectorEffect="non-scaling-stroke"
    />
    <path
      d={path}
      stroke="var(--color-ink)"
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** Sign with a finger or mouse; hands back the finished path after each stroke */
export const SignaturePad: FC<{
  path: string;
  onChange: (path: string) => void;
  className?: string;
}> = ({ path, onChange, className }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  // The stroke under the pointer right now, kept apart until it's lifted
  const [stroke, setStroke] = useState<Array<Point> | null>(null);

  function toPoint(e: PointerEvent): Point {
    const box = svgRef.current!.getBoundingClientRect();
    return [
      round(((e.clientX - box.left) / box.width) * WIDTH),
      round(((e.clientY - box.top) / box.height) * HEIGHT),
    ];
  }

  function handleDown(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setStroke([toPoint(e)]);
  }

  function handleMove(e: PointerEvent) {
    if (stroke) setStroke([...stroke, toPoint(e)]);
  }

  function handleUp() {
    if (!stroke) return;
    onChange([path, strokeToPath(stroke)].filter(Boolean).join(' '));
    setStroke(null);
  }

  const shown = [path, stroke && strokeToPath(stroke)]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox={VIEW_BOX}
      role="img"
      aria-label="signature pad"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className={cn('touch-none cursor-crosshair', className)}
    >
      {/* The line you sign on */}
      <line
        x1={16}
        x2={WIDTH - 16}
        y1={HEIGHT * 0.75}
        y2={HEIGHT * 0.75}
        stroke="var(--color-line)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <path
        d={shown}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
