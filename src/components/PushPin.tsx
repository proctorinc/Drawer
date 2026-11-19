import type { CSSProperties, FC } from 'react';
import { cn } from '@/utils';

/** Pin head colors, cycled so neighbouring polaroids get different pins */
export const PIN_COLORS = ['#ff6b57', '#3a7bd5', '#ffb400', '#2f9e5b'];

// Where the needle meets the paper; the pin leans around this point
const TIP_X = 20;
const TIP_Y = 36;

// The pin's outline, standing upright: cap, pinched neck, flared base
const BODY = `M13.5 7 V11 C13.5 13.5 18 14.5 18 17.5 V27 H22 V17.5 C22 14.5 26.5 13.5 26.5 11 V7 Z`;

type Props = {
  color: string;
  /** Degrees the pin leans from upright; negative leans left */
  lean?: number;
  /** Rendered width in px; height follows */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * A push pin stuck in at an angle, so you see its profile: a domed cap,
 * a pinched grip, a flared base and a bit of needle, all inked like the rest
 * of the UI with an offset shadow on the paper behind
 */
export const PushPin: FC<Props> = ({
  color,
  lean = 18,
  size = 32,
  className,
  style,
}) => {
  const light = `color-mix(in srgb, ${color} 65%, white)`;
  const dark = `color-mix(in srgb, ${color} 80%, var(--color-ink))`;

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn('pointer-events-none overflow-visible', className)}
      style={style}
    >
      {/* Shadow cast on the paper, falling down and to the right */}
      <g
        transform={`translate(3 2.5) rotate(${lean} ${TIP_X} ${TIP_Y})`}
        fill="var(--color-ink)"
        opacity="0.2"
      >
        <path d={BODY} />
        <ellipse cx={TIP_X} cy="7" rx="6.5" ry="2.2" />
        <ellipse cx={TIP_X} cy="27.5" rx="6" ry="2" />
      </g>

      <g
        transform={`rotate(${lean} ${TIP_X} ${TIP_Y})`}
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        {/* Needle, disappearing into the paper */}
        <path
          d={`M${TIP_X} 29 L${TIP_X} ${TIP_Y}`}
          stroke="var(--color-pencil)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Grip and cap sides */}
        <path d={BODY} fill={color} />
        {/* Shading down the far side of the grip */}
        <path
          d="M24.5 12.8 C22.6 14.4 21.5 15.5 21.5 17.5 V26.5"
          fill="none"
          stroke={dark}
          strokeWidth="1.6"
        />
        {/* Flared base */}
        <ellipse cx={TIP_X} cy="27.5" rx="6" ry="2" fill={dark} />
        {/* Top of the cap */}
        <ellipse cx={TIP_X} cy="7" rx="6.5" ry="2.2" fill={light} />
        {/* Shine down the near side */}
        <path
          d="M15.6 9.2 V10.6 M19 17.5 V24"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    </svg>
  );
};
