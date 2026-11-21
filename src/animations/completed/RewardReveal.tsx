import './completed.css';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { useStageHost } from '../StageHost';
import { StepCount, hasNext } from '../StepCount';
import PaperBits from './PaperBits';
import { useStageExit } from './useStageExit';
import type { CSSProperties, FC } from 'react';
import type { StageComponent } from '../types';
import type { AchievementReward, DecorationId } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { StarIcon } from '@/components/icons';
import { DECORATIONS } from '@/decorations/decorations';
import { stickerAnchor } from '@/pages/trophies/components/AchievementCard';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { rewardReveal } from '@/sound/sfx';
import { useCueWhileShown } from '@/sound/useCue';

// The preview avatar is a picture of you, not a link to your profile
const ignoreClick = () => {};

const decorationOf = (reward: AchievementReward) =>
  reward.id in DECORATIONS ? (reward.id as DecorationId) : null;

/** You, wearing it */
const DecorationPreview: FC<{ decoration: DecorationId }> = ({
  decoration,
}) => {
  const me = useUser();
  return (
    <span className="flex scale-125">
      <UserProfileIcon
        user={{ ...me, decoration }}
        size="2xl"
        showLevel={false}
        onClick={ignoreClick}
      />
    </span>
  );
};

/** A blank sketchbook page with a pencil, waiting for your face */
const ProfilePicArt: FC = () => (
  <svg viewBox="0 0 120 120" className="size-40" aria-hidden="true">
    <path
      d="M18 14q42-4 84 1 3 44-1 90-42 3-82-1-4-45-1-90z"
      fill="white"
      stroke="var(--color-ink)"
      strokeWidth={3}
      strokeLinejoin="round"
    />
    <circle
      cx="60"
      cy="56"
      r="26"
      fill="var(--color-butter)"
      stroke="var(--color-ink)"
      strokeWidth={2.5}
      strokeDasharray="6 5"
    />
    <circle cx="51" cy="52" r="2.6" fill="var(--color-ink)" />
    <circle cx="69" cy="52" r="2.6" fill="var(--color-ink)" />
    <path
      d="M50 64q10 8 20 0"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    {/* The pencil */}
    <g transform="rotate(-38 92 96)">
      <rect
        x="70"
        y="90"
        width="40"
        height="11"
        fill="var(--color-xmas-gold)"
        stroke="var(--color-ink)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M70 90l-12 5.5 12 5.5z"
        fill="var(--color-blush)"
        stroke="var(--color-ink)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M61.5 93.9l-3.5 1.6 3.5 1.6z" fill="var(--color-ink)" />
      <rect
        x="110"
        y="90"
        width="7"
        height="11"
        fill="var(--color-coral)"
        stroke="var(--color-ink)"
        strokeWidth={2.5}
      />
    </g>
  </svg>
);

/** Anything this build doesn't have art for */
const GenericArt: FC = () => (
  <span className="grid place-items-center size-36 bg-me border-[3px] border-ink rounded-blob">
    <StarIcon size={72} fill="white" />
  </span>
);

/** The present the reward comes out of: a box and a lid, flat and outlined */
const Present: FC = () => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center"
  >
    <span className="reward-box relative flex flex-col items-center">
      <svg viewBox="0 0 180 40" className="reward-lid w-48 -mb-1 relative z-10">
        <path
          d="M90 16q-22-22-30-8t30 8q22-22 30-8t-30 8"
          fill="var(--color-butter)"
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d="M6 16h168l-2 22H8z"
          fill="var(--color-coral)"
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <rect
          x="78"
          y="16"
          width="24"
          height="22"
          fill="var(--color-butter)"
          stroke="var(--color-ink)"
          strokeWidth={3}
        />
      </svg>
      <svg viewBox="0 0 168 110" className="w-44">
        <path
          d="M3 2h162l-3 105H6z"
          fill="var(--color-coral)"
          stroke="var(--color-ink)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <rect
          x="72"
          y="2"
          width="24"
          height="105"
          fill="var(--color-butter)"
          stroke="var(--color-ink)"
          strokeWidth={3}
        />
        <path
          d="M18 20v14M30 60v14M130 28v14M144 70v14"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="2 7"
        />
      </svg>
    </span>
  </span>
);

const rise = (delay: number): CSSProperties => ({
  animationDelay: `${delay}s`,
});

/**
 * A reward unlocked by a sticker or achievement: it bursts out of a present,
 * big in the middle of the screen, with a button to go use it. Stays until
 * you pick a button; rewards are special.
 */
export const RewardReveal: StageComponent<'reward'> = ({
  payload,
  onDone,
  step,
}) => {
  const { host, preview } = useStageHost();
  const navigate = useNavigate();
  const { leaving, exit, finish } = useStageExit(onDone);
  const titleId = useId();
  const { reward, from } = payload;
  const decoration = decorationOf(reward);
  const customPic = reward.id === 'CUSTOM_PROFILE_PIC';
  useCueWhileShown(rewardReveal);

  const go = () => {
    // The admin preview stays put; the button just closes it
    if (preview) {
      finish();
      return;
    }
    if (decoration) {
      void navigate({ to: '/draw/profile/me', hash: 'decorations' });
    } else if (customPic) {
      void navigate({ to: '/draw/profile/pic' });
    } else {
      void navigate({
        to: '/draw/profile/me/stickers',
        hash: stickerAnchor(from),
      });
    }
    finish();
  };

  const goLabel = decoration
    ? 'wear it'
    : customPic
      ? 'draw your face'
      : 'see trophies';

  // Focus lands on the main button once it's in
  const goRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(
      () => goRef.current?.querySelector('button')?.focus(),
      1500,
    );
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="completed-dim absolute inset-0 paper opacity-95"
        data-leaving={leaving || undefined}
        aria-hidden="true"
      />

      <div
        className="completed-card relative flex flex-col items-center gap-4 w-full max-w-[22rem] py-6 text-center"
        data-leaving={leaving || undefined}
      >
        <span
          className="completed-rise flex flex-col items-center gap-2"
          style={rise(0.1)}
        >
          <StepCount step={step} />
          <span className="text-sm uppercase tracking-widest text-pencil">
            you unlocked
          </span>
        </span>

        <span className="relative grid place-items-end justify-items-center w-full h-60">
          <Present />
          <span className="reward-prize relative grid place-items-center h-52 w-full">
            <PaperBits delay={1.25} />
            {decoration ? (
              <DecorationPreview decoration={decoration} />
            ) : customPic ? (
              <ProfilePicArt />
            ) : (
              <GenericArt />
            )}
          </span>
        </span>

        <div className="completed-rise flex flex-col gap-1.5" style={rise(1.5)}>
          <h2
            id={titleId}
            className="font-accent font-bold text-4xl leading-none"
          >
            <span className="highlight">{reward.name.toLowerCase()}</span>
          </h2>
          <p className="text-lg text-pencil leading-tight">
            {reward.description}
          </p>
          <p className="text-sm text-pencil/80">for earning {from.name}</p>
        </div>

        <div
          ref={goRef}
          className="completed-rise flex flex-col gap-2 w-full max-w-[16rem]"
          style={rise(1.7)}
        >
          <Button disableLoad onClick={go}>
            {goLabel}
          </Button>
          <button
            type="button"
            className="py-2 font-accent text-xl text-pencil underline decoration-line decoration-2 underline-offset-4 cursor-pointer"
            onClick={exit}
          >
            {hasNext(step) ? 'later · next →' : 'later'}
          </button>
        </div>
      </div>
    </div>,
    host,
  );
};

export default RewardReveal;
