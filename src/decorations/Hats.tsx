import {
  COLORS,
  Overlay,
  Sparkle,
  fineInk,
  ink,
  motion,
  onCircle,
} from './art';
import type { FC } from 'react';

/*
 * Things worn on top of the head. The top of the avatar is (50, 0), and the
 * head's outline passes through about (25, 7) and (75, 7), so brims hug that
 * curve and the rest stands up above it.
 */

/** A toilet plunger, suctioned on and wobbling */
export const PlungerHat: FC = () => (
  <Overlay>
    <g transform="rotate(-10 50 8)">
      <g
        style={motion('swing 2.4s ease-in-out infinite', '50% 100%', {
          '--swing': '6deg',
        })}
      >
        {/* Boing lines */}
        <path
          d="M39 -40l-5-3M61 -40l5-3M37 -33l-5 0M63 -33l5 0"
          fill="none"
          {...fineInk}
        />
        <rect
          x={46.5}
          y={-44}
          width={7}
          height={34}
          rx={3.5}
          fill={COLORS.wood}
          {...ink}
        />
        <path
          d="M48.5 -38v20"
          fill="none"
          stroke="#a86b33"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          d="M30 10C28 -24 72 -24 70 10Q50 -8 30 10z"
          fill={COLORS.red}
          {...ink}
        />
        <path
          d="M36 -3Q38 -11 45 -14"
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        {/* The rubber lip, squashed onto the head */}
        <path
          d="M27 11Q50 -9 73 11Q75 15 70 14Q50 -3 30 14Q25 15 27 11z"
          fill="#b8322a"
          {...ink}
        />
      </g>
    </g>
  </Overlay>
);

/** A beanie with a propeller that never stops */
export const PropellerCap: FC = () => (
  <Overlay>
    <g transform="rotate(-8 50 12)">
      <path d="M50 -10v-8" fill="none" {...ink} />
      <g style={motion('deco-propel 0.5s linear infinite alternate')}>
        <path
          d="M50 -18Q43 -23 35 -18.5Q43 -14.5 50 -18z"
          fill={COLORS.sky}
          {...ink}
        />
        <path
          d="M50 -18Q57 -13 65 -17.5Q57 -22 50 -18z"
          fill={COLORS.butter}
          {...ink}
        />
      </g>
      <circle cx={50} cy={-18} r={2.2} fill={COLORS.coral} {...fineInk} />
      {/* Visor */}
      <path d="M64 11Q80 7 91 15Q79 18 66 15.5z" fill={COLORS.sky} {...ink} />
      <path
        d="M24 14C24 -18 76 -18 76 14Q50 6 24 14z"
        fill={COLORS.coral}
        {...ink}
      />
      <path
        d="M50 -10C45 -6 41 3 41 10.48Q50 9.52 59 10.48C59 3 55 -6 50 -10z"
        fill={COLORS.butter}
        {...ink}
      />
      <circle cx={50} cy={-10} r={2.4} fill={COLORS.green} {...fineInk} />
    </g>
  </Overlay>
);

/** An artist's beret, with a brush tucked in the band */
export const Beret: FC = () => (
  <Overlay>
    <g transform="rotate(9 50 10)">
      {/* Paintbrush, behind the beret */}
      <g transform="translate(24 10) rotate(-140)">
        <rect
          x={0}
          y={-1.6}
          width={22}
          height={3.2}
          rx={1.6}
          fill={COLORS.wood}
          {...fineInk}
        />
        <rect
          x={20}
          y={-2}
          width={4}
          height={4}
          fill={COLORS.silver}
          {...fineInk}
        />
        <path
          d="M24 -2.2Q30 -2 32 0Q30 2 24 2.2z"
          fill={COLORS.blue}
          {...fineInk}
        />
      </g>
      <path
        d="M18 13C10 2 24 -12 50 -12C76 -12 93 -2 84 10Q52 3 18 13z"
        fill={COLORS.red}
        {...ink}
      />
      <path
        d="M30 -2Q38 -8 48 -8"
        fill="none"
        stroke="#ff8a7d"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M19 13Q52 3 84 10L85 15Q52 8 21 18z"
        fill={COLORS.ink}
        {...ink}
      />
      <path d="M50 -12q1-5 5-7" fill="none" {...ink} strokeWidth={2.4} />
    </g>
  </Overlay>
);

/** Three floppy points with jingling bells */
export const JesterHat: FC = () => {
  const bells = [
    { x: -3, y: 5, delay: '0s' },
    { x: 51, y: -33, delay: '0.3s' },
    { x: 103, y: 5, delay: '0.6s' },
  ];
  return (
    <Overlay>
      <path
        d="M28 9C18 -7 4 -8 -3 5C8 -2 18 3 36 6z"
        fill={COLORS.coral}
        {...ink}
      />
      <path
        d="M72 9C82 -7 96 -8 103 5C92 -2 82 3 64 6z"
        fill={COLORS.coral}
        {...ink}
      />
      <path
        d="M34 6C37 -12 45 -26 51 -33C56 -20 62 -8 66 6z"
        fill={COLORS.butter}
        {...ink}
      />
      <path d="M22 15Q50 1 78 15L79 7Q50 -6 21 7z" fill={COLORS.sky} {...ink} />
      {[30, 40, 50, 60, 70].map((x, i) => (
        <path
          key={x}
          d={`M${x} ${i === 2 ? 2.5 : 4}l2.5 2.5l-2.5 2.5l-2.5-2.5z`}
          fill={COLORS.coral}
          {...fineInk}
        />
      ))}
      {bells.map((bell) => (
        <g key={bell.x} transform={`translate(${bell.x} ${bell.y})`}>
          <g
            style={motion(
              `swing 0.9s ease-in-out ${bell.delay} infinite`,
              '50% 0%',
              { '--swing': '18deg' },
            )}
          >
            <circle cx={0} cy={3} r={3.8} fill={COLORS.gold} {...ink} />
            <path d="M-2 4.5h4" fill="none" {...fineInk} />
          </g>
        </g>
      ))}
    </Overlay>
  );
};

/** An apple balanced on top, with a worm peeking out */
export const AppleHat: FC = () => (
  <Overlay>
    <g transform="rotate(6 50 4)">
      <path
        d="M50 -15C44 -21 33 -17 34 -6C35 4 44 8 50 5C56 8 65 4 66 -6C67 -17 56 -21 50 -15z"
        fill={COLORS.red}
        {...ink}
      />
      <path
        d="M39 -10Q40 -15 44 -16"
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path d="M50 -15Q50 -20 52 -23" fill="none" {...ink} strokeWidth={2.2} />
      <path
        d="M51 -19Q58 -26 64 -21Q57 -15 51 -19z"
        fill={COLORS.green}
        {...ink}
      />
      {/* Worm */}
      <ellipse cx={61} cy={-3} rx={2.6} ry={1.4} fill={COLORS.ink} />
      <g transform="translate(61 -3)">
        <g
          style={motion('swing 1.3s ease-in-out infinite', '50% 100%', {
            '--swing': '14deg',
          })}
        >
          <rect
            x={-2.2}
            y={-11}
            width={4.4}
            height={11}
            rx={2.2}
            fill={COLORS.pink}
            {...fineInk}
          />
          <path
            d="M-2 -6h4M-2 -3h4"
            fill="none"
            {...fineInk}
            strokeWidth={0.8}
          />
          <circle cx={0.6} cy={-8.4} r={0.8} fill={COLORS.ink} />
        </g>
      </g>
    </g>
  </Overlay>
);

/** A crown of crayons standing in a paper band */
export const CrayonCrown: FC = () => {
  // The band's top edge runs from (23, 6) over (50, -4) to (77, 6)
  const bandTop = (x: number) => {
    const t = (x - 23) / 54;
    return 6 - 20 * t * (1 - t);
  };
  const crayons = [
    { x: 29, h: 15, color: COLORS.blue },
    { x: 39.5, h: 19, color: COLORS.green },
    { x: 50, h: 22, color: COLORS.red },
    { x: 60.5, h: 19, color: COLORS.gold },
    { x: 71, h: 15, color: COLORS.purple },
  ];
  return (
    <Overlay>
      {crayons.map(({ x, h, color }) => {
        const base = bandTop(x) + 4;
        return (
          <g
            key={x}
            transform={`translate(${x} ${base}) rotate(${(x - 50) * 0.55})`}
          >
            <path
              d={`M-4 0V${-h}L-1.5 ${-h - 6}h3L4 ${-h}V0z`}
              fill={color}
              {...ink}
            />
            <path
              d={`M-4 ${-h + 4}h8M-4 ${-h + 7}h8`}
              fill="none"
              {...fineInk}
            />
          </g>
        );
      })}
      <path d="M23 6Q50 -14 77 6L76 14Q50 -4 24 14z" fill="#f4e9d2" {...ink} />
      <path
        d="M27 10l3-2.5l3 2l3-2.6l3 2l3-2.4l3 1.8l3-2.2l3 1.8l3-2.2l3 2l3-2.4l3 2l3-2.6l3 2l3-2.4"
        transform="translate(-1 -1.5)"
        fill="none"
        {...fineInk}
        strokeWidth={0.9}
      />
    </Overlay>
  );
};

/** A floating golden halo, ringed with sparkles */
export const Halo: FC = () => (
  <Overlay>
    <g className="animate-float [transform-box:fill-box]">
      <g transform="translate(50 -10) rotate(-6)">
        <path
          d="M-25 0a25 7.5 0 1 0 50 0a25 7.5 0 1 0-50 0zM-17.5 0a17.5 3.6 0 1 0 35 0a17.5 3.6 0 1 0-35 0z"
          fill={COLORS.gold}
          fillRule="evenodd"
          {...ink}
        />
        <path
          d="M-20 -4.2Q-6 -7.4 10 -6.6"
          fill="none"
          stroke={COLORS.goldLight}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      <Sparkle x={20} y={-20} r={4.5} fill={COLORS.butter} delay="0s" />
      <Sparkle x={82} y={-18} r={3.5} fill={COLORS.butter} delay="0.5s" />
      <Sparkle x={58} y={-26} r={2.6} fill={COLORS.butter} delay="0.9s" />
      <Sparkle x={36} y={-2} r={2.4} fill={COLORS.butter} delay="1.2s" />
    </g>
  </Overlay>
);

/** A gold crown with gems, for grandmasters */
export const Crown: FC = () => (
  <Overlay>
    <g transform="rotate(-10 50 10)">
      <path
        d="M28 6L23 -19L37 -7L50 -26L63 -7L77 -19L72 6Q50 -2 28 6z"
        fill={COLORS.gold}
        {...ink}
      />
      <path
        d="M33 -6L31 -13M50 -16V-20"
        fill="none"
        stroke={COLORS.goldLight}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M28 14Q50 5 72 14L72 6Q50 -2 28 6z"
        fill={COLORS.goldDeep}
        {...ink}
      />
      <circle cx={23} cy={-19} r={3} fill={COLORS.coral} {...fineInk} />
      <circle cx={50} cy={-26} r={3.4} fill={COLORS.blue} {...fineInk} />
      <circle cx={77} cy={-19} r={3} fill={COLORS.coral} {...fineInk} />
      <path d="M38 8l2.5-3l2.5 3l-2.5 3z" fill={COLORS.green} {...fineInk} />
      <path
        d="M50 5.5l3-3.5l3 3.5l-3 3.5z"
        transform="translate(-3 0)"
        fill={COLORS.red}
        {...fineInk}
      />
      <path d="M57 8l2.5-3l2.5 3l-2.5 3z" fill={COLORS.blue} {...fineInk} />
    </g>
    <Sparkle x={16} y={-8} r={4} delay="0s" fill={COLORS.butter} />
    <Sparkle x={86} y={-30} r={3.4} delay="0.6s" fill={COLORS.butter} />
    <Sparkle x={62} y={-36} r={2.6} delay="1.1s" fill={COLORS.butter} />
  </Overlay>
);

/** A laurel wreath around the crown of the head, for a month without a miss */
export const LaurelWreath: FC = () => {
  // Leaves step up each side from the temples to just short of the top
  const side = (from: number, to: number) =>
    Array.from({ length: 7 }, (_, i) => from + ((to - from) * i) / 6);
  const leaves = [
    ...side(196, 258).map((deg) => ({ deg, tilt: 40 })),
    ...side(344, 282).map((deg) => ({ deg, tilt: -40 })),
  ];
  return (
    <Overlay>
      <path
        d="M17 29A47 47 0 0 1 46 3M83 29A47 47 0 0 0 54 3"
        fill="none"
        {...ink}
        stroke={COLORS.goldDeep}
        strokeWidth={2.4}
      />
      {leaves.map(({ deg, tilt }) => {
        const { x, y } = onCircle(deg, 49);
        return (
          <ellipse
            key={deg}
            cx={x}
            cy={y}
            rx={6.4}
            ry={2.8}
            transform={`rotate(${deg + 90 + tilt} ${x} ${y})`}
            fill={COLORS.green}
            {...fineInk}
          />
        );
      })}
      {[226, 314].map((deg) => {
        const { x, y } = onCircle(deg, 44);
        return (
          <circle
            key={deg}
            cx={x}
            cy={y}
            r={2.2}
            fill={COLORS.gold}
            {...fineInk}
          />
        );
      })}
      <path d="M45 1l5 4l5-4l-1 7l-4-2l-4 2z" fill={COLORS.gold} {...ink} />
      <Sparkle x={12} y={8} r={3.4} fill={COLORS.butter} delay="0s" />
      <Sparkle x={90} y={14} r={2.8} fill={COLORS.butter} delay="0.7s" />
    </Overlay>
  );
};
