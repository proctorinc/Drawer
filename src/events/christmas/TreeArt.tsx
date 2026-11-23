import { useId } from 'react';
import type { FC } from 'react';

/** The tree's drawing box; ChristmasTree hangs its ornaments in the same one */
export const TREE_BOX = { w: 340, h: 470 };

// Drawn around the ornament spots (see ChristmasTree's ROWS)
const CX = 170;
const INK = 'var(--color-ink)';
const PINE = '#ddf1e2';
const PINE_LIT = '#a6d9b1';
const NEEDLE = '#5f9e6e';
const GOLD = 'var(--color-xmas-gold)';
const RED = 'var(--color-xmas-red)';
const GREEN = 'var(--color-xmas-green)';

/**
 * The tree's three tiers, back to front, each tucked under the hem of the one
 * above: where its top edge sits and how wide it is there, then the same for
 * its scalloped hem. Each holds whole rows of days (2, then 3, then 3), and
 * its hem runs just under its last row, so no line cuts through a day.
 */
const TIERS = [
  { top: 262, topHalf: 74, bottom: 410, bottomHalf: 168, scallops: 9 },
  { top: 150, topHalf: 50, bottom: 282, bottomHalf: 120, scallops: 7 },
  { top: 28, topHalf: 0, bottom: 154, bottomHalf: 76, scallops: 5 },
];
type Tier = (typeof TIERS)[number];

/** How far the sides bow out past a straight line, for a hand-drawn swell */
const BULGE = 7;

/** A tier's outline: bowed sides, and a hem that droops in scallops */
function tierPath({ top, topHalf, bottom, bottomHalf, scallops }: Tier) {
  const midY = (top + bottom) / 2;
  const midHalf = (topHalf + bottomHalf) / 2 + BULGE;
  const width = (bottomHalf * 2) / scallops;
  let hem = '';
  for (let i = 0; i < scallops; i++) {
    // Not quite even, like a pen going round them
    const depth = i % 2 ? 9 : 7;
    hem += `q${-width / 2} ${depth} ${-width} 0`;
  }
  return [
    `M${CX - topHalf} ${top}`,
    `L${CX + topHalf} ${top}`,
    `Q${CX + midHalf} ${midY} ${CX + bottomHalf} ${bottom}`,
    hem,
    `Q${CX - midHalf} ${midY} ${CX - topHalf} ${top}`,
    'Z',
  ].join('');
}

/** Little flicks of needles: down each side just inside the edge, and above the hem */
function needles({ top, topHalf, bottom, bottomHalf }: Tier) {
  const marks: Array<string> = [];
  for (const t of [0.35, 0.6, 0.85]) {
    const y = top + (bottom - top) * t;
    const half = topHalf + (bottomHalf - topHalf) * t;
    for (const side of [-1, 1]) {
      const x = CX + side * (half - 12);
      marks.push(`M${x} ${y}q${side * 4} 1 ${side * 7} 6`);
      marks.push(`M${x - side * 6} ${y + 2}q${side * 4} 1 ${side * 7} 6`);
    }
  }
  const hemY = bottom - 10;
  const across = Math.floor(bottomHalf / 26);
  for (let i = -across; i <= across; i++) {
    const x = CX + i * 26 + 9;
    marks.push(`M${x} ${hemY}l-4 6M${x} ${hemY}l4 6`);
  }
  return marks.join('');
}

/** A lump of snow sat on a branch tip, at (x, y), leaning off the side it's on */
function snowAt(x: number, y: number, side: -1 | 1) {
  // Relative points, mirrored for the left side
  const steps: Array<[number, number, number, number]> = [
    [2, -7, 9, -6],
    [4, -5, 10, -1],
    [6, 0, 7, 6],
    [-2, 4, -10, 4],
    [-9, 2, -16, -3],
  ];
  return `M${x - side * 12} ${y + 1}${steps
    .map(([c1, c2, e1, e2]) => `q${side * c1} ${c2} ${side * e1} ${e2}`)
    .join('')}z`;
}

/** Beads on a string, swagged across a tier */
const Garland: FC<{ d: string; color: string }> = ({ d, color }) => (
  <>
    <path d={d} fill="none" stroke={INK} strokeWidth={1} opacity={0.5} />
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      strokeDasharray="0 9"
    />
  </>
);

/** A wrapped present: a box, a ribbon each way, and a bow on top */
const Present: FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  ribbon: string;
}> = ({ x, y, w, h, fill, ribbon }) => {
  const mid = x + w / 2;
  return (
    <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
      <rect x={x} y={y} width={w} height={h} rx={2} fill={fill} />
      <path
        d={`M${mid - 3} ${y}h6v${h}h-6zM${x} ${y + h / 2 - 3}h${w}v6h${-w}z`}
        fill={ribbon}
        strokeWidth={1.5}
      />
      <path
        d={`M${mid} ${y}c-4-8-12-8-11-2c1 3 7 3 11 2zM${mid} ${y}c4-8 12-8 11-2c-1 3-7 3-11 2z`}
        fill={ribbon}
        strokeWidth={1.5}
      />
    </g>
  );
};

/**
 * The tree, drawn: three tiers of pine with scalloped hems and needles doodled
 * in, snow on the branch tips, beaded garlands, and presents round the trunk.
 * filledTop is how far up the pine has deepened in color, a row at a time as
 * the days come round (null for none yet).
 */
const TreeArt: FC<{ filledTop: number | null; starLit: boolean }> = ({
  filledTop,
  starLit,
}) => {
  // useId's colons don't survive url(#...), so drop them
  const id = `tree${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox={`0 0 ${TREE_BOX.w} ${TREE_BOX.h}`}
      overflow="visible"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      {/* Little rays round the star: a soft yellow, brightening to gold once its day comes */}
      <g
        stroke={starLit ? GOLD : '#f2c94c'}
        strokeWidth={starLit ? 2.2 : 1.6}
        strokeLinecap="round"
        opacity={starLit ? 1 : 0.8}
      >
        {[-150, -120, -60, -30, 0, 180].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const [r1, r2] = deg % 60 ? [41, 45] : [42, 48];
          return (
            <path
              key={deg}
              d={`M${CX + r1 * Math.cos(a)} ${26 + r1 * Math.sin(a)}L${CX + r2 * Math.cos(a)} ${26 + r2 * Math.sin(a)}`}
            />
          );
        })}
      </g>

      {/* The trunk, with a bit of grain */}
      <rect
        x={152}
        y={398}
        width={36}
        height={46}
        rx={3}
        fill="#c99060"
        stroke={INK}
        strokeWidth={2.5}
      />
      <path
        d="M162 418q2 10 0 22M176 416q-2 8 1 16M170 430q2 5 0 10"
        fill="none"
        stroke="#8a5a34"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {TIERS.map((tier, i) => {
        const d = tierPath(tier);
        return (
          <g key={tier.top}>
            <clipPath id={`${id}-${i}`}>
              <path d={d} />
            </clipPath>
            <path d={d} fill={PINE} />
            {filledTop !== null && (
              <rect
                x={0}
                y={filledTop}
                width={TREE_BOX.w}
                height={TREE_BOX.h - filledTop}
                fill={PINE_LIT}
                clipPath={`url(#${id}-${i})`}
                className="transition-[y,height] duration-700 ease-out"
              />
            )}
            <path
              d={needles(tier)}
              fill="none"
              stroke={NEEDLE}
              strokeWidth={1.6}
              strokeLinecap="round"
              opacity={0.7}
            />
            <path
              d={d}
              fill="none"
              stroke={INK}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {/* Snow piled on each tip of the hem */}
            <path
              d={`${snowAt(CX - tier.bottomHalf + 4, tier.bottom - 4, -1)}${snowAt(CX + tier.bottomHalf - 4, tier.bottom - 4, 1)}`}
              fill="#fff"
              stroke={INK}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      <Garland d="M124 106q46 22 92 0" color={GOLD} />
      <Garland d="M76 234q94 30 188 0" color={RED} />
      <Garland d="M34 362q136 36 272 0" color={GOLD} />

      {/* A drift of snow to stand in, a skirt round the trunk, and presents */}
      <path
        d="M24 460q30-14 70-8q40-10 80-4q46-8 84 2q36-4 58 10q-146 8-292 0z"
        fill="#fff"
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M108 450q62-24 124 0q-8 6-15 1q-8 6-16 0q-8 6-16 0q-8 6-15 0q-8 6-16 0q-8 6-15 0q-8 6-16 0q-8 6-15-1z"
        fill={RED}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Present x={74} y={428} w={40} h={30} fill={RED} ribbon={GOLD} />
      <Present x={214} y={434} w={34} h={24} fill={GREEN} ribbon={RED} />
      <Present x={252} y={444} w={24} h={16} fill="#9fd3f0" ribbon="#fff" />
    </svg>
  );
};

export default TreeArt;
