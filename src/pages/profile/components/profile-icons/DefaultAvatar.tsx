import { defaultAvatarFor } from './sketchFace';
import type { AvatarParts, Extra, Glasses, Hair, Neckline } from './sketchFace';
import type { FC, ReactNode } from 'react';
import type { User } from '@/api/Api';
import { userColor } from '@/utils';

/*
 * A head and shoulders sketched with one marker: the user's color behind, the
 * deep shade of it as the pen, nothing else. The head is the draw-your-face
 * guide's (src/pages/profile/components/AvatarGuide.tsx) and hair rises into
 * the room above it, where hats sit, like a drawn face's would.
 */

/** Rendered width of each avatar size, in px */
const SIZE_PX = { xs: 24, sm: 36, lg: 48, xl: 80, '2xl': 128 } as const;
export type AvatarSize = keyof typeof SIZE_PX;

/** How thick the marker line should look at each size, in px */
const LINE_PX = { xs: 1.5, sm: 2, lg: 2.4, xl: 3.2, '2xl': 4.4 } as const;

/** The guide's head. Hair, glasses and beards are drawn around a bigger one
 * at (50, 41) r31 and shrunk onto it */
const HEAD = { cx: 50, cy: 46, r: 25 };
const PART_SCALE = HEAD.r / 31;
const onHead = `translate(${HEAD.cx} ${HEAD.cy}) scale(${PART_SCALE}) translate(-50 -41)`;

/**
 * A bumpy edge along a circle around (50, 41), for curly hair: from angle
 * `from` to `to` (degrees, 0 = right, 90 = down), in `n` bumps
 */
const curls = (r: number, from: number, to: number, n: number) => {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)} ${(41 + r * Math.sin(a)).toFixed(1)}`;
  };
  const step = (to - from) / n;
  const bump = ((2 * Math.PI * r * Math.abs(step)) / 360) * 0.62;
  let d = `M${at(from)}`;
  for (let i = 1; i <= n; i++)
    d += ` A${bump.toFixed(1)} ${bump.toFixed(1)} 0 0 1 ${at(from + step * i)}`;
  return d;
};

/** Hair drawn behind the head (long hair, a bun) and over it (the top, bangs) */
const HAIR_ART: Record<Hair, { back?: ReactNode; front: ReactNode }> = {
  crop: {
    front: (
      <path d="M19 41C17 19 32 7 50 7C68 7 83 19 81 41C74 32 63 28 50 28C37 28 26 32 19 41Z" />
    ),
  },
  sidePart: {
    front: (
      <>
        <path d="M19 41C16 17 35 6 54 7C72 8 84 21 81 41C79 30 73 23 63 20C53 26 35 27 19 41Z" />
        <path d="M63 20C62 15 60 11 58 8" fill="none" />
      </>
    ),
  },
  spiky: {
    front: (
      <path d="M19 39L20 22L27 24L29 10L38 18L43 3L51 15L58 3L63 17L71 8L73 22L80 21L81 39C73 29 62 25 50 26C38 25 27 29 19 39Z" />
    ),
  },
  buzz: {
    front: (
      <path
        d="M21 33C26 17 38 10 50 10C62 10 74 17 79 33C70 27 60 25 50 25C40 25 30 27 21 33Z"
        strokeDasharray="3 2.5"
      />
    ),
  },
  quiff: {
    front: (
      <path d="M19 39C18 23 27 15 37 12C39 1 60 -3 73 7C67 7 63 8 61 11C73 14 83 23 81 39C74 31 62 27 50 28C38 27 26 31 19 39Z" />
    ),
  },
  curly: {
    front: <path d={`${curls(33, 165, 375, 9)} C70 26 30 26 18.1 49.5Z`} />,
  },
  messy: {
    front: (
      <>
        <path d="M19 39C17 19 32 7 50 7C68 7 83 19 81 39C76 33 72 30 66 28L62 33L56 27L48 32L44 26L34 30L30 27C25 30 21 34 19 39Z" />
        <path d="M44 8C40 4 36 4 33 6M58 8C61 3 66 2 69 4" fill="none" />
      </>
    ),
  },
  mohawk: {
    front: (
      <path d="M44 27L41 3L48 8L51 -1L56 7L60 4L56 27C52 25 48 25 44 27Z" />
    ),
  },
  long: {
    back: (
      <path d="M17 44C14 18 31 5 50 5C69 5 86 18 83 44L87 88C78 92 70 90 66 86L34 86C30 90 22 92 13 88Z" />
    ),
    front: (
      <path d="M19 41C18 19 33 8 50 8C67 8 82 19 81 41C74 31 66 25 56 23C48 29 31 31 19 41Z" />
    ),
  },
  bob: {
    back: (
      <path d="M15 58C9 23 28 4 50 4C72 4 91 23 85 58C80 63 72 63 69 58L31 58C28 63 20 63 15 58Z" />
    ),
    front: (
      <path d="M20 36C22 16 36 8 50 8C64 8 78 16 80 36L73 32L65 35L57 31L49 35L41 31L33 35L26 32Z" />
    ),
  },
  ponytail: {
    back: (
      <>
        <path d="M72 18C92 16 98 42 89 66C87 51 84 39 76 31Z" />
        <path d="M74 19L79 26" fill="none" />
      </>
    ),
    front: (
      <path d="M19 40C17 18 33 7 50 7C67 7 83 18 81 40C74 32 63 28 50 28C37 28 26 32 19 40Z" />
    ),
  },
  bun: {
    back: <circle cx={76} cy={17} r={10} />,
    front: (
      <path d="M19 40C17 18 33 8 50 8C67 8 83 18 81 40C74 32 63 28 50 28C37 28 26 32 19 40Z" />
    ),
  },
  curlyLong: {
    back: <path d={`${curls(40, 115, 425, 14)}Z`} />,
    front: <path d={`${curls(32, 180, 360, 8)} C68 30 32 30 18 41Z`} />,
  },
  pigtails: {
    back: (
      <>
        <path d="M22 34C8 32 4 52 10 66C14 56 18 48 24 44Z" />
        <path d="M78 34C92 32 96 52 90 66C86 56 82 48 76 44Z" />
      </>
    ),
    front: (
      <>
        <path d="M19 40C17 18 33 8 50 8C67 8 83 18 81 40C74 30 62 23 50 23C38 23 26 30 19 40Z" />
        <path d="M50 8L50 23" fill="none" />
      </>
    ),
  },
  sweep: {
    back: (
      <path d="M17 44C14 18 31 5 50 5C69 5 86 18 83 44L86 80C76 84 70 82 68 76L32 76C30 82 24 84 14 80Z" />
    ),
    front: (
      <path d="M19 45C15 16 40 4 62 8C77 11 85 25 81 45C77 31 71 25 63 23C55 35 37 41 19 45Z" />
    ),
  },
  wavy: {
    back: (
      <path d="M17 44C14 18 31 5 50 5C69 5 86 18 83 44Q89 52 84 60Q90 68 84 76Q78 82 72 76L28 76Q22 82 16 76Q10 68 16 60Q11 52 17 44Z" />
    ),
    front: (
      <path d="M19 40C17 18 33 7 50 7C67 7 83 18 81 40Q72 28 62 26Q56 32 50 26Q44 32 38 26Q28 28 19 40Z" />
    ),
  },
};

const NECKLINE_ART: Record<Neckline, ReactNode> = {
  crew: <path d="M39 80Q50 88 61 80" fill="none" />,
  vNeck: <path d="M40 79L50 92L60 79" fill="none" />,
  collar: (
    <>
      <path d="M41 79L37 87L47 86L50 81L53 86L63 87L59 79" />
      <path d="M50 86L50 100" fill="none" strokeDasharray="0.1 4" />
    </>
  ),
  hoodie: (
    <>
      <path d="M27 84C30 73 70 73 73 84C64 80 36 80 27 84Z" />
      <path d="M45 84L44 96M55 84L56 96" fill="none" />
    </>
  ),
  turtleneck: (
    <>
      <path d="M39 70L39 84Q50 88 61 84L61 70Q50 74 39 70Z" />
      <path d="M40 75Q50 79 60 75M40 79.5Q50 83.5 60 79.5" fill="none" />
    </>
  ),
};

const GLASSES_ART: Record<Glasses, ReactNode> = {
  none: null,
  square: (
    <g fill="none">
      <rect x={29} y={37} width={16} height={11} rx={3} />
      <rect x={55} y={37} width={16} height={11} rx={3} />
      <path d="M45 41Q50 38 55 41M29 41L19.5 39M71 41L80.5 39" />
    </g>
  ),
  round: (
    <g fill="none">
      <circle cx={37} cy={43} r={7.5} />
      <circle cx={63} cy={43} r={7.5} />
      <path d="M44.5 42Q50 39 55.5 42M29.5 42L19.5 39M70.5 42L80.5 39" />
    </g>
  ),
};

const EXTRA_ART: Record<Extra, ReactNode> = {
  none: null,
  beard: (
    <path d="M20 46C21 66 34 75 50 75C66 75 79 66 80 46C73 58 63 61 50 61C37 61 27 58 20 46Z" />
  ),
  mustache: <path d="M38 58Q44 53 50 57Q56 53 62 58" fill="none" />,
  earrings: (
    <g fill="none">
      <circle cx={19.5} cy={53} r={3} />
      <circle cx={80.5} cy={53} r={3} />
    </g>
  ),
};

/**
 * A circle drawn by hand: a little lumpy, and the ends overrun each other
 * where the pen came back round
 */
const sketchCircle = ({ cx, cy, r }: typeof HEAD) => {
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    const a = ((-115 + t * 372) * Math.PI) / 180;
    const rr = r * (1 + 0.02 * Math.sin(a * 3 + 1)) + t * 1.2;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
  // Through the midpoints, so it curves instead of zigzagging
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d}L${f(lx)} ${f(ly)}`;
};

const HEAD_PATH = sketchCircle(HEAD);

/**
 * Back to front. Every shape is filled with the background, so what's behind
 * it hides and only the pen line shows
 */
const Figure: FC<{ parts: AvatarParts; line: number }> = ({ parts, line }) => {
  const hairdo = HAIR_ART[parts.hair];
  // Parts are shrunk onto the head, so their pen is thickened to match
  const partLine = line / PART_SCALE;
  return (
    <>
      <path d="M14 104C14 89 29 76 50 76C71 76 86 89 86 104Z" />
      <g transform={onHead} strokeWidth={partLine}>
        {hairdo.back}
      </g>
      <path d="M45 66L45 82L55 82L55 66Z" stroke="none" />
      <path d="M45 66L45 78M55 66L55 78" fill="none" />
      {/* The face, filled but not inked; the hand-drawn ring goes on top */}
      <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} stroke="none" />
      <path d={HEAD_PATH} fill="none" />
      <g transform={onHead} strokeWidth={partLine}>
        {EXTRA_ART[parts.extra]}
        {hairdo.front}
      </g>
      {NECKLINE_ART[parts.neckline]}
      <g transform={onHead} strokeWidth={partLine}>
        {GLASSES_ART[parts.glasses]}
      </g>
    </>
  );
};

type Props = {
  user: Pick<User, 'id' | 'username' | 'colorHue'>;
  size?: AvatarSize;
  /** Override the picked parts, e.g. to show off every hairdo */
  parts?: AvatarParts;
};

export const DefaultAvatar: FC<Props> = ({ user, size = 'lg', parts }) => {
  const look = parts ?? defaultAvatarFor(user);
  const { primary, text } = userColor(user);
  const line = (LINE_PX[size] * 100) / SIZE_PX[size];

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="size-full"
      style={{ backgroundColor: primary }}
      fill={primary}
      stroke={text}
      strokeWidth={line}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={`rotate(${look.tilt} 50 60)`}>
        <Figure parts={look} line={line} />
      </g>
    </svg>
  );
};
