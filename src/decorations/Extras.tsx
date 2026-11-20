import {
  COLORS,
  Overlay,
  Sparkle,
  fineInk,
  ink,
  motion,
  onCircle,
} from './art';
import type { CSSProperties, FC } from 'react';

/*
 * Decorations worn somewhere other than the top of the head: tucked behind an
 * ear, stuck on a cheek, floating alongside, or wrapped all the way around.
 * The bottom right is left clear for the level badge.
 */

/** A pencil tucked behind the ear */
export const PencilEar: FC = () => (
  <Overlay>
    <g transform="translate(104 14) rotate(126)">
      <rect
        x={0}
        y={-3.6}
        width={7}
        height={7.2}
        rx={2.4}
        fill={COLORS.pink}
        {...ink}
      />
      <rect
        x={6}
        y={-3.6}
        width={4.5}
        height={7.2}
        fill={COLORS.silver}
        {...ink}
      />
      <rect
        x={10.5}
        y={-3.6}
        width={23.5}
        height={7.2}
        fill={COLORS.gold}
        {...ink}
      />
      <path
        d="M11 0h22.5"
        fill="none"
        stroke={COLORS.goldDeep}
        strokeWidth={1}
      />
      <path d="M34 -3.6L44 0L34 3.6z" fill="#f2d6a8" {...ink} />
      <path d="M40.6 -1.2L44 0L40.6 1.2z" fill={COLORS.ink} />
    </g>
  </Overlay>
);

const BandAid: FC<{ angle: number }> = ({ angle }) => (
  <g transform={`rotate(${angle})`}>
    <rect
      x={-14}
      y={-4.6}
      width={28}
      height={9.2}
      rx={4.6}
      fill="#f4c79a"
      {...ink}
    />
    <rect
      x={-5}
      y={-3.4}
      width={10}
      height={6.8}
      rx={1.4}
      fill="#fbe6cc"
      {...fineInk}
    />
    {[-10, 10].flatMap((x) =>
      [-1.6, 1.6].map((y) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={0.7} fill="#c48b57" />
      )),
    )}
  </g>
);

/** Crossed band-aids on a sore spot, still throbbing */
export const BandAids: FC = () => (
  <Overlay>
    <g transform="translate(24 25)">
      <BandAid angle={38} />
      <BandAid angle={-42} />
    </g>
    <path
      d="M7 8l-5-4M14 3l-1-6M4 17h-6"
      fill="none"
      {...fineInk}
      className="animate-blink"
    />
  </Overlay>
);

/** A giant foam "number one" finger, poking at your cheek */
export const FoamFinger: FC = () => (
  <Overlay>
    <g transform="translate(-14 84) rotate(-28)">
      <g style={motion('deco-poke 2.2s ease-in-out infinite')}>
        <rect
          x={14}
          y={1}
          width={21}
          height={7.4}
          rx={3.7}
          fill={COLORS.gold}
          {...ink}
        />
        <rect
          x={-7}
          y={3}
          width={8}
          height={12}
          rx={1.6}
          fill={COLORS.red}
          {...ink}
        />
        <path
          d="M0 2Q0 -1 4 -1H15Q20 -1 20 4V14Q20 18 15 18H4Q0 18 0 15z"
          fill={COLORS.gold}
          {...ink}
        />
        <path d="M8 -1Q9 -6 14 -5Q16 -3 14 -1" fill={COLORS.gold} {...ink} />
        <path d="M15 8.5h5M15 12.5h5" fill="none" {...fineInk} />
        <text
          x={7.5}
          y={13.8}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={COLORS.red}
          className="font-accent"
        >
          1
        </text>
      </g>
    </g>
  </Overlay>
);

/** A speech bubble that's always typing */
export const SpeechBubble: FC = () => (
  <Overlay>
    <g className="animate-float [transform-box:fill-box]">
      <path
        d="M77 -16h16a9 9 0 0 1 9 9v2a9 9 0 0 1-9 9h-11l-10 8l2-8a9 9 0 0 1-6-9v-2a9 9 0 0 1 9-9z"
        fill="#fff"
        {...ink}
      />
      {[79, 85, 91].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={-6}
          r={2}
          fill={COLORS.ink}
          style={motion(`deco-typing 1.2s ease-in-out ${i * 0.18}s infinite`)}
        />
      ))}
    </g>
  </Overlay>
);

/** A bright idea, hovering by your head */
export const Lightbulb: FC = () => (
  <Overlay>
    <g transform="translate(84 -4) rotate(20)">
      <g className="animate-float [transform-box:fill-box]">
        {[-150, -120, -90, -60, -30].map((deg, i) => {
          const a = (deg * Math.PI) / 180;
          return (
            <path
              key={deg}
              d={`M${15 * Math.cos(a)} ${15 * Math.sin(a)}L${20 * Math.cos(a)} ${20 * Math.sin(a)}`}
              fill="none"
              {...ink}
              stroke={COLORS.goldDeep}
              strokeWidth={2}
              className="animate-blink"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          );
        })}
        <path
          d="M0 -12a10 10 0 0 1 7 17q-2 2-2 5h-10q0-3-2-5a10 10 0 0 1 7-17z"
          fill={COLORS.butter}
          {...ink}
        />
        <path
          d="M-4.5 -6Q-4 -9 -1 -9.5"
          fill="none"
          stroke="#fff"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <path
          d="M-3 5l1.5-5l1.5 3l1.5-3l1.5 5"
          fill="none"
          {...fineInk}
          stroke={COLORS.goldDeep}
        />
        <rect
          x={-5}
          y={10}
          width={10}
          height={6}
          rx={1.5}
          fill={COLORS.silver}
          {...ink}
        />
        <path d="M-5 13h10" fill="none" {...fineInk} />
        <path d="M-2 16h4l-1 2h-2z" fill={COLORS.ink} {...fineInk} />
      </g>
    </g>
  </Overlay>
);

const RAINDROPS = [
  { x: 40, delay: 0 },
  { x: 51, delay: 0.55 },
  { x: 61, delay: 0.95 },
];

/** A little rain cloud with a silver lining */
export const RainCloud: FC = () => (
  <Overlay>
    {RAINDROPS.map(({ x, delay }) => (
      <g key={x} transform={`translate(${x} 0)`}>
        <path
          d="M0 -3Q2.6 0.6 0 1.9Q-2.6 0.6 0 -3z"
          fill={COLORS.blue}
          {...fineInk}
          strokeWidth={0.9}
          style={motion(`deco-rain 1.4s linear ${delay}s infinite`)}
        />
      </g>
    ))}
    <g className="animate-float [transform-box:fill-box]">
      <path
        d="M33 -3A8 8 0 0 1 36 -17A11 11 0 0 1 57 -20A9 9 0 0 1 70 -11A7 7 0 0 1 68 -3z"
        fill="#dde4ec"
        {...ink}
      />
      <path
        d="M36 -5.6H65.5"
        fill="none"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M36 -5.6H65.5"
        fill="none"
        stroke={COLORS.silver}
        strokeWidth={1}
        strokeDasharray="1 3"
      />
      <Sparkle x={34} y={-17} r={3} fill={COLORS.silver} delay="0s" />
      <Sparkle x={66} y={-19} r={2.6} fill={COLORS.silver} delay="0.7s" />
    </g>
  </Overlay>
);

/** A terry sweatband, with sweat to show for it */
export const Sweatband: FC = () => (
  <Overlay>
    {/* Sits a little down the forehead */}
    <g transform="translate(0 5)">
      {/* Knot tails */}
      <path d="M86 19q8 1 13 9q-7 1-11-4z" fill="#fff" {...ink} />
      <path d="M87 22q6 7 4 16q-5-4-6-11z" fill="#fff" {...ink} />
      <path d="M13 17Q50 -1 87 17L89 26Q50 8 11 26z" fill="#fff" {...ink} />
      <path
        d="M12 21.5Q50 3.5 88 21.5"
        fill="none"
        stroke={COLORS.coral}
        strokeWidth={3}
      />
      <g transform="translate(4 30)">
        <path
          d="M0 -4Q3.2 0.8 0 2.4Q-3.2 0.8 0 -4z"
          fill={COLORS.blue}
          {...fineInk}
          style={motion('deco-sweat 1.8s ease-in 0.4s infinite')}
        />
      </g>
    </g>
  </Overlay>
);

// A gilded frame: a scalloped gold ring hugging the avatar's edge
const FRAME = (() => {
  const bumps = 24;
  const r = 56;
  const pts = Array.from({ length: bumps }, (_, i) =>
    onCircle((360 / bumps) * i, r),
  );
  let outer = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i <= bumps; i++) {
    const p = pts[i % bumps];
    outer += `A8.5 8.5 0 0 1 ${p.x} ${p.y}`;
  }
  const inner = `M100 50A50 50 0 1 0 0 50A50 50 0 1 0 100 50z`;
  const beads = Array.from({ length: 36 }, (_, i) =>
    onCircle(i * 10 + 5, 53.5),
  );
  return { ring: `${outer}z${inner}`, beads };
})();

/** An ornate gold picture frame, fit for a gallery */
export const GildedFrame: FC = () => (
  <Overlay>
    <path d={FRAME.ring} fill={COLORS.gold} fillRule="evenodd" {...ink} />
    {FRAME.beads.map(({ x, y }) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={COLORS.goldDeep} />
    ))}
    {/* Crest on top, plaque below */}
    <path d="M38 -2Q50 -20 62 -2Q50 -7 38 -2z" fill={COLORS.gold} {...ink} />
    <circle cx={50} cy={-8} r={3} fill={COLORS.red} {...fineInk} />
    <rect
      x={38}
      y={101}
      width={24}
      height={9}
      rx={2}
      fill={COLORS.goldLight}
      {...ink}
    />
    <path d="M43 105.5h14" fill="none" {...fineInk} strokeDasharray="2 1.5" />
    <Sparkle x={8} y={8} r={5} delay="0s" />
    <Sparkle x={94} y={4} r={4} delay="0.5s" />
    <Sparkle x={-4} y={74} r={3.5} delay="1s" />
  </Overlay>
);

// A ring of fire around the top and sides; angles are degrees clockwise from 3 o'clock
const FLAMES = [
  160, 178, 196, 214, 232, 250, 268, 286, 304, 322, 340, 358, 16,
].map((deg, i) => {
  // Point outward, but lean up like real flames
  let out = (deg + 90) % 360;
  if (out > 180) out -= 360;
  const size = 0.75 + 0.35 * Math.sin((i * 7) % 5) ** 2;
  return {
    ...onCircle(deg, 46),
    angle: out * 0.72,
    size,
    delay: (i % 4) * 0.17,
  };
});

/** Flames licking up all around you: unstoppable */
export const Blaze: FC = () => (
  <Overlay>
    {FLAMES.map(({ x, y, angle, size, delay }, i) => (
      <g
        key={i}
        transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}
      >
        <g
          style={motion(
            `deco-flame 0.9s ease-in-out ${delay}s infinite`,
            '50% 100%',
          )}
        >
          <path
            d="M0 0C-7 0 -9 -7 -4 -14C-3 -9 0 -10 0 -21C6 -14 10 -6 7 -2C6 0 3 0 0 0z"
            fill={i % 2 ? COLORS.coral : '#ff8a2a'}
            {...ink}
          />
          <path
            d="M0 -1C-3 -1 -4 -4 -1.5 -8C0 -6 1 -6 1.5 -10C4 -6 4 -2 0 -1z"
            fill={COLORS.butter}
          />
        </g>
      </g>
    ))}
  </Overlay>
);

const STARS = [
  { x: -12, y: 20, r: 3, delay: '0s' },
  { x: 108, y: 32, r: 2.6, delay: '0.6s' },
  { x: 20, y: 112, r: 2.4, delay: '1.1s' },
];

const spin = (seconds: number, reverse = false): CSSProperties =>
  motion(`deco-orbit ${seconds}s linear infinite${reverse ? ' reverse' : ''}`);

/** The sun and moon circling you, a year of doodles in orbit */
export const Orbit: FC = () => {
  const dots = Array.from({ length: 40 }, (_, i) => onCircle(i * 9, 60));
  return (
    <Overlay>
      {STARS.map((s) => (
        <Sparkle key={s.x} {...s} fill={COLORS.butter} />
      ))}
      <g style={spin(14)}>
        {/* Keeps the group's box centered on the avatar, so it turns around its middle */}
        <circle cx={50} cy={50} r={70} fill="none" />
        {dots.map(({ x, y }) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={COLORS.ink} />
        ))}
        <g transform="translate(50 -10)">
          <g style={spin(14, true)}>
            <circle r={10} fill="none" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <path
                key={deg}
                d="M0 -7.5V-10"
                transform={`rotate(${deg})`}
                fill="none"
                {...ink}
                stroke={COLORS.goldDeep}
              />
            ))}
            <circle r={5.5} fill={COLORS.gold} {...ink} />
          </g>
        </g>
        <g transform="translate(50 110)">
          <g style={spin(14, true)}>
            <circle r={10} fill="none" />
            <path
              d="M2 -7A7 7 0 1 0 6 4.5A6 6 0 1 1 2 -7z"
              fill={COLORS.sky}
              {...ink}
            />
          </g>
        </g>
      </g>
    </Overlay>
  );
};

const Wing: FC = () => (
  <g style={motion('deco-flap 1.6s ease-in-out infinite', '100% 68%')}>
    <path
      d="M0 0C-6 -16 -22 -28 -40 -30C-36 -24 -38 -20 -34 -16C-38 -12 -37 -8 -32 -5C-35 -1 -33 3 -27 4C-28 8 -24 11 -18 10C-16 13 -10 14 -6 11C-3 9 -1 5 0 0z"
      fill={COLORS.lilac}
      {...ink}
    />
    <path d="M-5 -4L-30 -22M-5 -1L-28 -9M-4 2L-20 5" fill="none" {...fineInk} />
    <path
      d="M0 0C-5 -10 -14 -16 -24 -16C-22 -12 -23 -9 -20 -7C-22 -4 -20 -1 -16 0C-16 4 -12 6 -8 5C-5 6 -2 4 0 0z"
      fill={COLORS.purple}
      {...ink}
    />
  </g>
);

/** A pair of mythic wings, flapping */
export const MythicWings: FC = () => (
  <Overlay>
    <g transform="translate(7 54) scale(0.85)">
      <Wing />
    </g>
    <g transform="translate(93 54) scale(-0.85 0.85)">
      <Wing />
    </g>
    <Sparkle x={-22} y={20} r={3.6} fill={COLORS.lilac} delay="0s" />
    <Sparkle x={122} y={24} r={3} fill={COLORS.lilac} delay="0.7s" />
    <Sparkle x={-8} y={4} r={2.2} fill={COLORS.lilac} delay="1.2s" />
  </Overlay>
);

const HEART =
  'M0 3C-6 -1 -5 -6 -2.5 -6C-1 -6 0 -5 0 -4C0 -5 1 -6 2.5 -6C5 -6 6 -1 0 3z';

const FLOATING_HEARTS = [
  { x: 2, y: 64, size: 1.1, color: COLORS.coral, drift: -4, delay: 0 },
  { x: 99, y: 58, size: 0.9, color: COLORS.pink, drift: 5, delay: 0.7 },
  { x: -6, y: 42, size: 0.8, color: COLORS.pink, drift: -3, delay: 1.4 },
  { x: 104, y: 34, size: 1, color: COLORS.coral, drift: 3, delay: 2.1 },
  { x: 92, y: 18, size: 0.7, color: COLORS.gold, drift: 4, delay: 2.6 },
];

/** Hearts floating up from your fans, plus one stuck to your cheek */
export const HeartSwarm: FC = () => (
  <Overlay>
    {FLOATING_HEARTS.map(({ x, y, size, color, drift, delay }) => (
      <g
        key={`${x}-${y}`}
        transform={`translate(${x} ${y}) scale(${size * 1.4})`}
      >
        <path
          d={HEART}
          fill={color}
          {...fineInk}
          style={motion(
            `deco-heart 3s ease-out ${delay}s infinite`,
            '50% 50%',
            {
              '--drift': `${drift}px`,
            },
          )}
        />
      </g>
    ))}
    <g transform="translate(12 84) rotate(-14) scale(2)">
      <path d={HEART} fill={COLORS.red} {...ink} />
      <path
        d="M-3 -3.4Q-2.5 -4.6 -1.4 -4.6"
        fill="none"
        stroke="#fff"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    </g>
  </Overlay>
);
