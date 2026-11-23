import type { FC } from 'react';

// His head from public/ai/grinch.svg: narrow on top, big cheeks, fur tufts
const HEAD =
  'M38 22Q50 14 62 22Q70 30 72 40L78 42L74 47L80 51L74 54Q74 68 64 76L58 80L54 86L50 80L46 86L42 80L36 76Q26 68 26 54L20 51L26 47L22 42L28 40Q30 30 38 22Z';
const TUFT = 'M46 19Q48 12 52 15Q54 10 57 16';
const HEART = 'M50 72C34 62 34 46 43 46C47 46 50 50 50 53C50 50 53 46 57 46C66 46 66 62 50 72Z';
const VIEWBOX = '14 8 72 84';

export type GrinchHeadState =
  /** A secret of his: dashed, with his grin and a question mark */
  | 'secret'
  /** A day of his still to come, or that slipped by: just the dashed outline */
  | 'empty'
  /** You joined him: his face, grinning */
  | 'joined'
  /** You turned him down: his outline, with a heart grown in it */
  | 'refused';

type Props = {
  state: GrinchHeadState;
  className?: string;
  /** Outline color for the dashed states; pencil grey unless given */
  color?: string;
  /** A question mark inside an empty head: a day he's still to ask about */
  question?: boolean;
};

/** The Grinch's head, in whichever state his day or secret is in */
export const GrinchHead: FC<Props> = ({
  state,
  className,
  color = 'var(--color-pencil)',
  question,
}) => {
  if (state === 'joined') {
    return (
      <svg viewBox={VIEWBOX} aria-hidden="true" className={className}>
        <g
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={HEAD} fill="#9bd45a" />
          <path d={TUFT} fill="none" />
          <ellipse cx="40" cy="45" rx="7" ry="6.5" fill="#fff6b8" />
          <ellipse cx="60" cy="45" rx="7" ry="6.5" fill="#fff6b8" />
          <path d="M31 36Q38 30 47 35M53 32Q61 25 69 31" fill="none" strokeWidth={4.5} />
          <path d="M31 60Q50 66 71 58Q62 73 50 73Q37 72 31 60Z" fill="#3f6b1e" />
        </g>
        <circle cx="43" cy="46" r="3" fill="var(--color-ink)" />
        <circle cx="63" cy="46" r="3" fill="var(--color-ink)" />
      </svg>
    );
  }

  const dashed = (
    <>
      <path
        d={HEAD}
        fill={state === 'refused' ? '#fff' : 'none'}
        stroke={state === 'refused' ? 'var(--color-ink)' : color}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeDasharray={state === 'refused' ? undefined : '6 5'}
      />
      <path
        d={TUFT}
        fill="none"
        stroke={state === 'refused' ? 'var(--color-ink)' : color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  );

  return (
    <svg viewBox={VIEWBOX} aria-hidden="true" className={className}>
      {dashed}
      {state === 'refused' && (
        <path
          d={HEART}
          fill="var(--color-xmas-red)"
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
      {state === 'empty' && question && (
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="34"
          fontWeight="700"
          fill={color}
          className="font-accent"
        >
          ?
        </text>
      )}
      {state === 'secret' && (
        <>
          {/* One cocked brow and the grin give him away */}
          <path
            d="M53 34Q61 27 69 33"
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d="M33 62Q50 68 69 60"
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <text
            x="50"
            y="55"
            textAnchor="middle"
            fontSize="26"
            fontWeight="700"
            fill={color}
            className="font-accent"
          >
            ?
          </text>
        </>
      )}
    </svg>
  );
};

/** A secret the Grinch is keeping, for achievement badges */
const GrinchOutline: FC<{ className?: string }> = ({ className }) => (
  <GrinchHead state="secret" className={className} />
);

export default GrinchOutline;
