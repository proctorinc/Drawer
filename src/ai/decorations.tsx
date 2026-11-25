import type { FC, ReactNode } from 'react';
import { SantaHat } from '@/events/christmas/Decorations';

/*
 * Decorations only AI judges wear. Players can't earn these, which helps make a
 * judge read as "not a person" at a glance. Each one draws in a 100×100 box laid
 * over the avatar (the avatar's edge is a circle of radius 50 around 50, 50),
 * flat: ink outlines, no shadows or gradients.
 *
 * To add one: draw it here, add it to AI_DECORATIONS, and it shows up in the
 * admin's decoration picker. The id is what's saved on the personality.
 */

const ink = {
  stroke: 'var(--color-ink)',
  strokeWidth: 2,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

const Overlay: FC<{ children: ReactNode }> = ({ children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    overflow="visible"
    className="absolute inset-0 size-full pointer-events-none"
  >
    {children}
  </svg>
);

/** A gold-rimmed monocle over the right eye, on a dangling chain */
const Monocle: FC = () => (
  <Overlay>
    <path
      d="M74 58q10 14 4 30q-3 8 4 14"
      fill="none"
      {...ink}
      stroke="var(--color-xmas-gold)"
      strokeWidth={1.5}
      strokeDasharray="2 2.5"
    />
    <circle cx="66" cy="45" r="14" fill="#fff" fillOpacity={0.35} {...ink} />
    <circle
      cx="66"
      cy="45"
      r="14"
      fill="none"
      stroke="var(--color-xmas-gold)"
      strokeWidth={2.5}
      vectorEffect="non-scaling-stroke"
    />
    <circle cx="66" cy="45" r="16" fill="none" {...ink} />
  </Overlay>
);

/** A tall top hat, perched at a jaunty angle */
const TopHat: FC = () => (
  <Overlay>
    <g transform="rotate(12 50 8)">
      <path d="M34 -30h32v36h-32z" fill="var(--color-ink)" {...ink} />
      <path d="M34 -2h32v7h-32z" fill="var(--color-coral)" {...ink} />
      <path
        d="M22 6q28 -6 56 0v5q-28 -6 -56 0z"
        fill="var(--color-ink)"
        {...ink}
      />
    </g>
  </Overlay>
);

/** A polka-dot party hat, knocked sideways, with a pom-pom */
const PartyHat: FC = () => (
  <Overlay>
    <g transform="rotate(-18 46 8)">
      <path d="M32 10 L48 -30 L64 10 Z" fill="var(--color-coral)" {...ink} />
      <circle cx="44" cy="0" r="3" fill="var(--color-butter)" stroke="none" />
      <circle cx="54" cy="4" r="3" fill="var(--color-butter)" stroke="none" />
      <circle
        cx="48"
        cy="-14"
        r="2.5"
        fill="var(--color-butter)"
        stroke="none"
      />
      <path d="M30 10 Q48 15 66 10" fill="none" {...ink} />
      <circle cx="48" cy="-32" r="5" fill="var(--color-sky)" {...ink} />
    </g>
  </Overlay>
);

const RedSantaHat: FC = () => <SantaHat />;

/** A hand-lettered "ON STRIKE" picket sign, held up off to one side */
const PicketSign: FC = () => (
  <Overlay>
    <g transform="rotate(10 96 22)">
      <path d="M96 30 V96" fill="none" {...ink} strokeWidth={3} />
      <rect x="76" y="8" width="40" height="22" rx="1.5" fill="#fff" {...ink} />
      <text
        x="96"
        y="17.5"
        textAnchor="middle"
        fontSize="8"
        fontWeight="800"
        fill="var(--color-coral)"
      >
        ON
      </text>
      <text
        x="96"
        y="26"
        textAnchor="middle"
        fontSize="8"
        fontWeight="800"
        fill="var(--color-coral)"
      >
        STRIKE
      </text>
    </g>
  </Overlay>
);

type AIDecoration = { name: string; Art: FC };

export const AI_DECORATIONS = {
  MONOCLE: { name: 'monocle', Art: Monocle },
  TOP_HAT: { name: 'top hat', Art: TopHat },
  PARTY_HAT: { name: 'party hat', Art: PartyHat },
  SANTA_HAT: { name: 'santa hat', Art: RedSantaHat },
  PICKET_SIGN: { name: 'picket sign', Art: PicketSign },
} satisfies Record<string, AIDecoration>;

export type AIDecorationId = keyof typeof AI_DECORATIONS;

/** Draws an AI decoration over its parent, the avatar's square, positioned box */
export const AIAvatarDecoration: FC<{ id: string }> = ({ id }) => {
  const decoration = (AI_DECORATIONS as Record<string, AIDecoration>)[id] as
    | AIDecoration
    | undefined;
  return decoration ? <decoration.Art /> : null;
};
