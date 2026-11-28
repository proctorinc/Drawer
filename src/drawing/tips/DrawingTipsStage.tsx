import './drawingTips.css';
import { Fragment, useEffect, useState } from 'react';
import { markTipsSeen } from './seen';
import type { CSSProperties, FC, ReactNode } from 'react';
import type { StageComponent } from '@/animations/types';
import type { Pencil } from '@/drawing/pencils';
import type { StagePage } from '@/animations/PagedStage';
import { PagedStage } from '@/animations/PagedStage';
import { useStageHost } from '@/animations/StageHost';
import { useStageExit } from '@/animations/completed/useStageExit';
import { EraserIcon, UndoIcon } from '@/components/icons';
import { cn } from '@/utils';

/** Replays a demo every `ms` by remounting it; still when motion is reduced */
const Loop: FC<{ ms: number; children: ReactNode }> = ({ ms, children }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return <Fragment key={tick}>{children}</Fragment>;
};

const seconds = (s: number | undefined) =>
  s === undefined ? undefined : `${s}s`;

/** A circle's path, starting from its left */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0`;

/** A disc of radius r, painted the way a finger would: one fat stroke going round */
const disc = (cx: number, cy: number, r: number) => ({
  d: circle(cx, cy, r / 2),
  width: r,
});

type StrokeProps = {
  d: string;
  color: string;
  /** In canvas units, like a pencil's size (the canvas is 370 across) */
  width: number;
  /** Seconds into the loop that it starts drawing; already there without one */
  at?: number;
  dur?: number;
  /** Seconds into the loop that undo takes it back */
  undoAt?: number;
};

const Stroke: FC<StrokeProps> = ({ d, color, width, at, dur, undoAt }) => (
  <path
    d={d}
    pathLength={1}
    fill="none"
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(
      at !== undefined && 'tip-draw',
      undoAt !== undefined && 'tip-undone',
    )}
    style={
      {
        '--at': seconds(at),
        '--dur': seconds(dur),
        '--undo-at': seconds(undoAt),
      } as CSSProperties
    }
  />
);

/** A little canvas, at the real canvas's scale */
const Sketch: FC<{ paper: string; size?: number; children: ReactNode }> = ({
  paper,
  size = 192,
  children,
}) => (
  <svg
    viewBox="0 0 370 370"
    width={size}
    height={size}
    className="block"
    style={{ backgroundColor: paper }}
  >
    {children}
  </svg>
);

const Frame: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={cn(
      'relative block overflow-hidden border-2 border-ink rounded-sketch shadow-pencil-sm',
      className,
    )}
  >
    {children}
  </span>
);

/** A toolbar button that gets used partway through a demo */
const ToolChip: FC<{
  className: string;
  style: CSSProperties;
  label: string;
  children: ReactNode;
}> = ({ className, style, label, children }) => (
  <span className="flex flex-col items-center gap-1">
    <span
      className={cn(
        'grid place-items-center size-11 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm',
        className,
      )}
      style={style}
    >
      {children}
    </span>
    <span className="text-xs text-pencil">{label}</span>
  </span>
);

type Palette = { a: string; b: string; c: string; paper: string };

/** Each pencil drawing a wave, at its real thickness */
const PencilsArt: FC<{ pencils: Array<Pencil>; paper: string }> = ({
  pencils,
  paper,
}) => (
  <Frame>
    <Sketch paper={paper}>
      <Loop ms={1000 + pencils.length * 600}>
        {pencils.map((p, i) => (
          <Stroke
            key={i}
            d={`M65 ${(370 * (i + 1)) / (pencils.length + 1)}q40 -40 80 0t80 0t80 0`}
            color={p.color}
            width={p.size}
            at={0.2 + i * 0.55}
            dur={0.6}
          />
        ))}
      </Loop>
    </Sketch>
  </Frame>
);

/** An eye: one color painted over another leaves a thin rim, then a pupil */
const LayeringArt: FC<{ colors: Palette }> = ({ colors }) => (
  <Frame>
    <Sketch paper={colors.paper}>
      <Loop ms={4200}>
        <Stroke {...disc(185, 185, 120)} color={colors.a} at={0.2} dur={0.8} />
        <Stroke {...disc(185, 185, 104)} color={colors.b} at={1.3} dur={0.8} />
        <Stroke {...disc(185, 185, 36)} color={colors.a} at={2.4} dur={0.4} />
      </Loop>
    </Sketch>
  </Frame>
);

/** The eraser carves a shine out of a ball; a slip gets undone */
const EraserArt: FC<{ colors: Palette; slipWidth: number }> = ({
  colors,
  slipWidth,
}) => (
  // One loop for the sketch and the buttons, so they stay in step
  <Loop ms={4600}>
    <span className="flex items-center gap-4">
      <Frame>
        <Sketch paper={colors.paper}>
          <Stroke {...disc(185, 185, 120)} color={colors.a} at={0.1} />
          <Stroke
            d="M112 178Q118 120 172 108"
            color={colors.paper}
            width={20}
            at={1.1}
          />
          <Stroke
            d="M50 300q50 -60 100 0t100 0t80 -30"
            color={colors.b}
            width={slipWidth}
            at={2.2}
            dur={0.5}
            undoAt={3.3}
          />
        </Sketch>
      </Frame>
      <span className="flex flex-col gap-3">
        <ToolChip
          label="eraser"
          className="tip-hold"
          style={{ '--at': '0.9s', '--dur': '1.1s' } as CSSProperties}
        >
          <EraserIcon />
        </ToolChip>
        <ToolChip
          label="undo"
          className="tip-press"
          style={{ '--at': '3.1s' } as CSSProperties}
        >
          <UndoIcon />
        </ToolChip>
      </span>
    </span>
  </Loop>
);

/** Two fingers spread over a tiny eye and it fills the canvas */
const ZoomArt: FC<{ colors: Palette }> = ({ colors }) => {
  const size = 192;
  // Where the eye sits, in canvas units
  const x = 185;
  const y = 160;
  return (
    <Frame>
      <Loop ms={5200}>
        <Sketch paper={colors.paper} size={size}>
          <g
            className="tip-zoom"
            style={{ '--origin': `${x}px ${y}px` } as CSSProperties}
          >
            <Stroke {...disc(x, y, 34)} color={colors.a} />
            <Stroke {...disc(x, y, 28)} color={colors.b} />
            <Stroke {...disc(x, y, 10)} color={colors.a} />
            <Stroke
              d="M40 300q80 -50 160 0t130 -10"
              color={colors.c}
              width={20}
            />
          </g>
        </Sketch>
        {['tip-finger-a', 'tip-finger-b'].map((finger) => (
          <span
            key={finger}
            aria-hidden="true"
            className={cn(
              'absolute size-7 -ml-3.5 -mt-3.5 rounded-full bg-ink/25 border-2 border-ink/60',
              finger,
            )}
            style={{ left: (x / 370) * size, top: (y / 370) * size }}
          />
        ))}
      </Loop>
    </Frame>
  );
};

/** A small outline lost in a corner, then the same idea big, filled and detailed */
const GoodDoodleArt: FC<{ colors: Palette }> = ({ colors }) => (
  <Loop ms={5000}>
    <span className="flex items-start gap-4">
      <span className="flex flex-col items-center gap-1">
        <Frame>
          <Sketch paper={colors.paper} size={120}>
            <Stroke
              d={circle(95, 95, 35)}
              width={20}
              color={colors.a}
              at={0.2}
              dur={0.6}
            />
          </Sketch>
        </Frame>
        <span className="text-sm text-pencil">meh</span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <Frame className="-rotate-2">
          <Sketch paper={colors.paper} size={120}>
            <Stroke {...disc(185, 185, 160)} color={colors.a} at={1} />
            <Stroke {...disc(185, 185, 144)} color={colors.b} at={1.8} />
            <Stroke
              d="M80 170Q86 92 160 78"
              color={colors.paper}
              width={20}
              at={2.6}
              dur={0.4}
            />
            <Stroke
              {...disc(140, 190, 22)}
              color={colors.a}
              at={3.1}
              dur={0.2}
            />
            <Stroke
              {...disc(230, 190, 22)}
              color={colors.a}
              at={3.3}
              dur={0.2}
            />
            <Stroke
              d="M140 260q45 35 90 0"
              color={colors.a}
              width={14}
              at={3.6}
              dur={0.4}
            />
          </Sketch>
        </Frame>
        <span className="font-accent font-bold text-lg leading-none">yes!</span>
      </span>
    </span>
  </Loop>
);

const Body: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="text-lg leading-snug text-pencil">{children}</p>
);

const GOOD_DOODLE = [
  'go big and fill the canvas',
  'fill shapes in solid',
  'add details finer than your pencil',
  'let the drawing explain itself, no labels',
];

function tipPages(pencils: Array<Pencil>, paper: string): Array<StagePage> {
  const a = pencils.at(0)?.color ?? 'var(--color-ink)';
  const b = pencils.at(1)?.color ?? a;
  const colors: Palette = { a, b, c: pencils.at(2)?.color ?? b, paper };
  const sameSize = pencils.every((p) => p.size === pencils[0]?.size);

  return [
    {
      id: 'pencils',
      art: <PencilsArt pencils={pencils} paper={paper} />,
      title: "today's pencils",
      body: (
        <Body>
          {sameSize
            ? 'Every pencil draws the same size line today.'
            : 'Thin pencils for details, thick ones for filling in.'}{' '}
          The colors are random, so get creative.
        </Body>
      ),
    },
    {
      id: 'layering',
      art: <LayeringArt colors={colors} />,
      title: 'thinner lines',
      body: (
        <Body>
          Paint over the edge of another color and leave a sliver showing.
          That's how you get outlines, pupils and fine detail.
        </Body>
      ),
    },
    {
      id: 'eraser',
      art: <EraserArt colors={colors} slipWidth={pencils.at(1)?.size ?? 20} />,
      title: 'eraser & undo',
      body: (
        <Body>
          The eraser cuts back to the paper, for shine and crisp edges. Slipped?
          Undo takes back your last stroke.
        </Body>
      ),
    },
    {
      id: 'zoom',
      art: <ZoomArt colors={colors} />,
      title: 'zoom in',
      body: <Body>Pinch the canvas to zoom in on the small stuff.</Body>,
    },
    {
      id: 'good',
      art: <GoodDoodleArt colors={colors} />,
      title: 'a great doodle',
      body: (
        <ul className="flex flex-col gap-1 text-lg leading-snug text-pencil">
          {GOOD_DOODLE.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ),
    },
  ];
}

/** How to get the most out of the day's pencils, a page at a time */
export const DrawingTipsStage: StageComponent<'drawingTips'> = ({
  payload,
  onDone,
}) => {
  const { preview } = useStageHost();
  const { leaving, exit } = useStageExit(onDone);

  // Once it's been up, it waits for the info button
  useEffect(() => {
    if (!preview) markTipsSeen();
  }, [preview]);

  return (
    <PagedStage
      eyebrow="drawing tips"
      leaving={leaving}
      onClose={exit}
      pages={tipPages(payload.pencils, payload.paper)}
    />
  );
};

export default DrawingTipsStage;
