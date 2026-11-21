import './completed.css';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { useStageHost } from '../StageHost';
import { StepCount, hasNext } from '../StepCount';
import PaperBits from './PaperBits';
import { useStageExit } from './useStageExit';
import type { CSSProperties, FC } from 'react';
import type { StageComponent } from '../types';
import type { Achievement } from '@/api/Api';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import Badge from '@/pages/trophies/components/Badge';
import { stickerAnchor } from '@/pages/trophies/components/AchievementCard';

/** Matches xpPerAchievement in server/internal/handlers/trophies.handler.go */
const XP_PER_ACHIEVEMENT = 25;

/** The card goes on its own after this long */
const AUTO_DISMISS_MS = 6000;

/** QuestList's hand-drawn checkbox, ticked */
const QuestCheck: FC = () => (
  <svg
    viewBox="0 0 30 30"
    fill="none"
    stroke="var(--color-ink)"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-20"
    aria-hidden="true"
  >
    <path
      d="M4 5.5q11-1.5 21.5-.5.8 10 0 21-11 .8-21 0-.7-10 .5-20.5z"
      fill="#fff6c9"
    />
    <path
      d="M8 15l5 6L27 3"
      stroke="var(--color-coral)"
      strokeWidth={3.5}
      pathLength={40}
      strokeDasharray={40}
      className="animate-scribble"
      style={{ animationDelay: '0.7s' }}
    />
  </svg>
);

/** QuestList's "done!" ink stamp */
const DoneStamp: FC = () => (
  <span
    className="completed-stamp absolute -right-3 -bottom-1 px-2 py-0.5 bg-white font-accent font-bold text-2xl uppercase text-coral border-[2.5px] border-coral rounded-sketch"
    style={{ '--tilt': '-12deg', animationDelay: '0.9s' } as CSSProperties}
  >
    done!
  </span>
);

const rise = (delay: number): CSSProperties => ({
  animationDelay: `${delay}s`,
});

type Shown = {
  heading: string;
  name: string;
  description: string;
  xp: number | null;
  /** Where "see it" goes */
  to:
    | { to: '/draw/event/$slug'; params: { slug: string } }
    | { to: '/draw/trophies'; hash?: string };
  seeLabel: string;
};

function describe(
  payload: Parameters<StageComponent<'completed'>>[0]['payload'],
): Shown {
  if (payload.kind === 'quest') {
    const { quest } = payload;
    return {
      heading: 'quest complete!',
      name: quest.title,
      description: quest.description,
      xp: null,
      to: { to: '/draw/trophies' },
      seeLabel: 'see quests',
    };
  }

  const { achievement } = payload;
  const sticker = payload.kind === 'sticker' && !!achievement.eventSlug;
  return {
    heading: sticker ? 'sticker earned!' : 'achievement unlocked!',
    name: achievement.name,
    description: achievement.description,
    xp: XP_PER_ACHIEVEMENT,
    to: sticker
      ? { to: '/draw/event/$slug', params: { slug: achievement.eventSlug! } }
      : { to: '/draw/trophies', hash: stickerAnchor(achievement) },
    seeLabel: sticker ? 'see stickers' : 'see it',
  };
}

/** The sticker or badge, slapped down onto the card like a rubber stamp */
const StampedArt: FC<{ achievement: Achievement; sticker: boolean }> = ({
  achievement,
  sticker,
}) => (
  <span className="relative grid place-items-center size-32">
    <PaperBits />
    <span
      className="completed-stamp grid place-items-center"
      style={{ '--tilt': sticker ? '-8deg' : '6deg' } as CSSProperties}
    >
      <Badge
        achievement={achievement}
        className={sticker ? 'w-24 h-26' : 'size-28'}
      />
    </span>
  </span>
);

/**
 * A centered card for finishing a sticker, an achievement or a weekly quest.
 * Tap away, press "nice!" or wait ~6s to dismiss.
 */
export const CompletedCard: StageComponent<'completed'> = ({
  payload,
  onDone,
  step,
}) => {
  const { host, preview } = useStageHost();
  const navigate = useNavigate();
  const { leaving, exit, finish } = useStageExit(onDone);
  const titleId = useId();
  const shown = describe(payload);

  // A lone card goes on its own; one of a set waits, so none slip past unseen
  const autoDismiss = !step;
  useEffect(() => {
    if (!autoDismiss) return;
    const t = setTimeout(exit, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [exit, autoDismiss]);

  const see = () => {
    // The admin preview stays put; the button just closes it
    if (!preview) void navigate(shown.to);
    finish();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="completed-dim absolute inset-0 bg-ink/45"
        data-leaving={leaving || undefined}
        onClick={exit}
        aria-hidden="true"
      />

      <div
        className="completed-card relative w-full max-w-[20rem]"
        data-leaving={leaving || undefined}
        data-thunk={payload.kind !== 'quest' || undefined}
      >
        <div className="completed-card-body relative flex flex-col items-center gap-3 px-5 pt-5 pb-6 bg-white border-2 border-ink rounded-sketch shadow-pencil text-center">
          <StepCount step={step} />
          <span className="text-xs uppercase tracking-widest text-pencil">
            {shown.heading}
          </span>

          {payload.kind === 'quest' ? (
            <span className="relative grid place-items-center size-32">
              <PaperBits delay={0.95} />
              <QuestCheck />
              <DoneStamp />
            </span>
          ) : (
            <StampedArt
              achievement={payload.achievement}
              sticker={payload.kind === 'sticker'}
            />
          )}

          <div className="completed-rise flex flex-col gap-1" style={rise(0.8)}>
            <h2
              id={titleId}
              className="font-accent font-bold text-3xl leading-none"
            >
              {shown.name}
            </h2>
            <p className="text-pencil leading-tight">{shown.description}</p>
          </div>

          {shown.xp !== null && (
            <span className="completed-rise" style={rise(0.95)}>
              <Chip className="h-7 px-3 font-accent font-bold text-lg bg-me -rotate-2">
                +{shown.xp} XP
              </Chip>
            </span>
          )}

          <div
            className="completed-rise flex gap-3 w-full mt-1"
            style={rise(1.05)}
          >
            <Button
              variant="base"
              size="sm"
              disableLoad
              className="flex-1"
              onClick={exit}
            >
              {hasNext(step) ? 'next →' : 'nice!'}
            </Button>
            <Button size="sm" disableLoad className="flex-1" onClick={see}>
              {shown.seeLabel}
            </Button>
          </div>

          {/* Burns down until the card goes on its own */}
          {autoDismiss && (
            <span
              aria-hidden="true"
              className="completed-fuse absolute left-4 right-4 bottom-2 h-1 rounded-full bg-me"
              style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
            />
          )}
        </div>
      </div>
    </div>,
    host,
  );
};

export default CompletedCard;
