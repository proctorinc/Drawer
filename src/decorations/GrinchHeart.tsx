import { COLORS, Overlay, Sparkle, fineInk, ink, motion } from './art';
import type { FC } from 'react';

const FUR = '#9bd45a';
const FUR_DEEP = '#7cbf3f';

const HEART =
  'M0 3C-6 -1 -5 -6 -2.5 -6C-1 -6 0 -5 0 -4C0 -5 1 -6 2.5 -6C5 -6 6 -1 0 3z';

/**
 * For getting a 0 from the Grinch: his furry green hand reaches in from the
 * bottom left (the level badge has the bottom right), holding out his heart,
 * which thumps a little bigger every beat.
 */
export const GrinchHeart: FC = () => (
  <Overlay>
    {/* Drawn reaching in from the bottom right, then mirrored to the left */}
    <g transform="matrix(-1 0 0 1 100 0)">
      {/* A short, furry forearm with a shaggy cuff */}
      <g transform="translate(86 88) rotate(-35)">
        <rect
          x={-7}
          y={0}
          width={14}
          height={22}
          rx={6}
          fill={FUR_DEEP}
          {...ink}
        />
        <path
          d="M-8.5 5L-6.5 0.5L-4 4L-1.5 0L1 4L3.5 0L6 4L8.5 0.5L8.5 6Q0 9 -8.5 6z"
          fill={FUR}
          {...ink}
        />
      </g>
      {/* The palm, under the heart */}
      <ellipse cx={80} cy={84} rx={11} ry={6} fill={FUR} {...ink} />

      {/* The heart, growing a size with every thump */}
      <g transform="translate(80 72)">
        <g style={motion('deco-grow 3.2s ease-in-out infinite', '50% 90%')}>
          <path d={HEART} transform="scale(3)" fill={COLORS.red} {...ink} />
          <path
            d="M-11 -13Q-9 -16.5 -5 -16.8"
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
        {/* "It's getting bigger!" ticks */}
        <path d="M-21 -18l-4-3M21 -18l4-3M0 -23v-5" fill="none" {...fineInk} />
      </g>

      {/* Stubby fingers curled up over the front of it */}
      <ellipse cx={72.5} cy={81} rx={3.4} ry={4.4} fill={FUR} {...ink} />
      <ellipse cx={79.5} cy={82.5} rx={3.4} ry={4.4} fill={FUR} {...ink} />
      <ellipse cx={86.5} cy={81} rx={3.4} ry={4.4} fill={FUR} {...ink} />

      <Sparkle x={60} y={58} r={3.4} fill={COLORS.butter} delay="0.4s" />
      <Sparkle x={100} y={60} r={2.6} fill={COLORS.butter} delay="1.1s" />
    </g>
  </Overlay>
);
