import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CountDownTimer } from '../../../daily/CountdownTimer';
import { PromptTitle } from './PromptTitle';
import { useLeaveGuard } from './useLeaveGuard';
import type { FC, ReactNode } from 'react';
import type { DailyPrompt, User } from '@/api/Api';
import type { PinchZoomHandle } from '@/drawing/usePinchZoom';
import { JudgeIntroReplayButton } from '@/ai/JudgeIntro';
import { TodaysJudgeChip, useTodaysJudge } from '@/ai/TodaysJudge';
import Button from '@/components/Button';
import { useConfirm } from '@/components/Confirm';
import { useFullscreenPage } from '@/components/AppShell';
import {
  ArrowLeftIcon,
  ClockIcon,
  PinIcon,
  TrophyIcon,
} from '@/components/icons';
import { CanvasSettingsButton } from '@/drawing/CanvasSettings';
import { useDrawing } from '@/drawing/DrawingContext';
import { Toolbar } from '@/drawing/Toolbar';
import { pencilsFor } from '@/drawing/pencils';
import ZoomableCanvas from '@/drawing/ZoomableCanvas';
import useUser from '@/auth/hooks/useUser';
import { TreeIcon } from '@/events/christmas/Decorations';
import OrnamentTally from '@/events/christmas/OrnamentTally';
import { useChristmas } from '@/events/useChristmas';
import { UnfinishedDoodleButton } from '@/daily/UnfinishedDoodleButton';
import { RedoButton } from '@/daily/RedoButton';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

/** A drawing on its way to the wall, from where its canvas sat */
export type Pinning = { imageUrl: string; from: DOMRect };

/**
 * Roomy: the full toolbar, a big pin button and the judge's criteria.
 * Compact (short, wide screens like an iPhone mini in Safari): the tools and
 * the pin share one row and the judge is a single line, so the canvas can
 * still take the whole width.
 */
type Fit = 'roomy' | 'compact';

// Space between the pieces of the desk, in px (gap-3 / gap-2)
const GAP: Record<Fit, number> = { roomy: 12, compact: 8 };
// Bigger than this and it's just a big empty square on a tablet
const MAX_CANVAS = 420;
const MIN_CANVAS = 160;
// Roomy only if it leaves the canvas nearly the full width
const ROOMY_ENOUGH = 0.94;

/** Who came up with the prompt, or nobody, and how long is left to draw it */
const DeskByline: FC<{ createdBy: User | null; fit: Fit }> = ({
  createdBy,
  fit,
}) => {
  const me = useUser();
  const timeLeft = (
    <span className="flex items-center gap-1 text-sm leading-none text-pencil whitespace-nowrap">
      <ClockIcon size={13} />
      <CountDownTimer format="short" /> left
    </span>
  );

  if (!createdBy) return timeLeft;

  const isMe = createdBy.id === me.id;
  const linkProps = isMe
    ? ({ to: '/draw/profile/me' } as const)
    : ({
        to: '/draw/profile/$userId',
        params: { userId: createdBy.id },
      } as const);

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Link {...linkProps} aria-label={`Prompt by ${createdBy.username}`}>
        {/* The link does the navigating, so the avatar's own click is a no-op */}
        <UserProfileIcon
          user={createdBy}
          size={fit === 'roomy' ? 'lg' : 'sm'}
          showLevel={false}
          onClick={() => {}}
        />
      </Link>
      <span className="flex flex-col gap-1 min-w-0">
        <Link
          {...linkProps}
          className="flex items-baseline gap-1.5 min-w-0 hover:underline"
        >
          <span className="text-sm leading-none text-pencil whitespace-nowrap">
            prompt by
          </span>
          <span className="font-accent font-bold text-xl leading-none truncate">
            {isMe ? 'you!' : createdBy.username}
          </span>
        </Link>
        {timeLeft}
      </span>
    </div>
  );
};

/** A prompt that isn't today's (finishing late, or a redo) */
export type PastDesk = {
  title: string;
  /** Under the title: how long is left, or which day it was */
  detail: ReactNode;
  /** Where the back button goes */
  backTo: '/draw' | '/draw/redo';
};

/** Drawing an earlier prompt: the way back, and what it is */
const PastByline: FC<PastDesk> = ({ title, detail, backTo }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <Link
      to={backTo}
      aria-label="Back"
      className="press flex flex-none items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm hover:-rotate-6"
    >
      <ArrowLeftIcon size={20} />
    </Link>
    <span className="flex flex-col gap-1 min-w-0">
      <span className="font-accent font-bold text-xl leading-none truncate">
        {title}
      </span>
      <span className="flex items-center gap-1 text-sm leading-none text-pencil whitespace-nowrap">
        {detail}
      </span>
    </span>
  </div>
);

/** Your own corners of the app; everyone else's drawings wait until you've drawn */
const DeskLinks = () => {
  const user = useUser();
  const christmas = useChristmas();

  return (
    <nav aria-label="Main" className="flex flex-none items-center gap-2">
      <CanvasSettingsButton />
      <Link
        // During Doodlemas the trophies page steps aside for the event's
        {...(christmas
          ? { to: '/draw/event/$slug', params: { slug: christmas.slug } }
          : { to: '/draw/trophies' })}
        aria-label={christmas ? christmas.name : 'Trophies'}
        className="press flex items-center justify-center size-10 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm hover:-rotate-6"
      >
        {christmas ? (
          <TreeIcon size={22} className="text-ink" />
        ) : (
          <TrophyIcon size={22} />
        )}
      </Link>
      <UserProfileIcon user={user} size="sm" />
    </nav>
  );
};

/**
 * Sizes the canvas to the room left once everything else on the desk is in
 * place, and picks the layout that leaves it the most. The canvas sits in a
 * column with the title right above it, so the two never drift apart.
 */
function useDeskFit() {
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>('roomy');
  const [size, setSize] = useState(0);
  const sizeRef = useRef(0);
  sizeRef.current = size;
  // What everything but the canvas needs in each layout, from the last time
  // it was on screen (a guess until then)
  const chrome = useRef<Record<Fit, number | null>>({
    roomy: null,
    compact: null,
  });
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useLayoutEffect(() => {
    const area = areaRef.current;
    const content = contentRef.current;
    if (!area || !content) return;

    const measure = () => {
      // The frame's 2px border goes around the canvas
      const width = Math.min(area.clientWidth - 4, MAX_CANVAS);
      const height = area.clientHeight;
      const current = fitRef.current;
      // Everything in the column except the canvas
      const extra = content.offsetHeight - sizeRef.current;
      chrome.current[current] = extra;

      const room = (layout: Fit) =>
        height -
        (chrome.current[layout] ?? extra * (layout === 'compact' ? 0.5 : 2));
      const roomy = room('roomy') >= width * ROOMY_ENOUGH;
      const next: Fit = roomy ? 'roomy' : 'compact';
      if (next !== current) {
        setFit(next);
        return;
      }
      setSize(
        Math.max(MIN_CANVAS, Math.floor(Math.min(width, height - extra))),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fit]);

  return { areaRef, contentRef, fit, size };
}

type DrawingDeskProps = {
  dailyPrompt: DailyPrompt;
  error: string | null;
  onSubmit: (png: Blob, canvas: HTMLCanvasElement | null) => void;
  /** Set while the drawing is being pinned: the tools fade while it animates */
  pinning: Pinning | null;
  /**
   * An earlier prompt (finished late, or a redo): today's judge and the event
   * tally don't apply, and the header leads back
   */
  past?: PastDesk;
};

/** Nothing but the prompt and the canvas, sized to fit any screen without scrolling */
const DrawingDesk: FC<DrawingDeskProps> = ({
  dailyPrompt,
  error,
  onSubmit,
  pinning,
  past,
}) => {
  const christmas = useChristmas();
  const { data: todaysJudge } = useTodaysJudge();
  const judge = past ? undefined : todaysJudge;
  const { canvasRef, hasInk, barelyDrawn, getPng } = useDrawing();
  const confirm = useConfirm();
  const zoomRef = useRef<PinchZoomHandle>(null);
  // A pinch anywhere on the desk zooms the canvas, never the page
  const deskRef = useRef<HTMLDivElement>(null);
  const { areaRef, contentRef, fit, size } = useDeskFit();
  const compact = fit === 'compact';
  // Just the canvas: the shell's masthead and navbar step aside
  useFullscreenPage();
  // A stray swipe or back button shouldn't whisk the drawing away
  const leaveGuard = useLeaveGuard(hasInk && !pinning);

  const backgroundColor =
    dailyPrompt.colors.length === 4 ? dailyPrompt.colors[3] : undefined;
  const pencils = pencilsFor(dailyPrompt);

  async function handleSubmit() {
    // A stray tap on the button shouldn't pin a near-blank page for good
    if (
      barelyDrawn &&
      !(await confirm({
        title: christmas ? 'hang it already?' : 'pin it already?',
        message:
          "there's barely anything on your page yet, and you can't change it once it's up.",
        confirmLabel: christmas ? 'hang it anyway' : 'pin it anyway',
        cancelLabel: 'keep drawing',
      }))
    ) {
      return;
    }
    // The pin flies from where the canvas sits, so show all of it first
    zoomRef.current?.reset(false);
    const png = await getPng(backgroundColor);
    onSubmit(png, canvasRef.current);
  }

  const submit = (
    <Button
      className={cn(compact ? 'grow px-4 max-[359px]:px-3 text-xl' : 'w-full')}
      onClick={handleSubmit}
      disabled={!hasInk}
    >
      {christmas ? (
        <>
          {compact ? (
            <span className="max-[359px]:sr-only">hang it</span>
          ) : (
            'hang it on the tree'
          )}
          <TreeIcon />
        </>
      ) : (
        <>
          {compact ? (
            <span className="max-[359px]:sr-only">pin it</span>
          ) : (
            'pin it to the wall'
          )}
          <PinIcon size={22} />
        </>
      )}
    </Button>
  );

  return (
    <div
      ref={deskRef}
      className="flex justify-center h-dvh overflow-hidden overscroll-none touch-none"
    >
      <main
        className={cn(
          'relative flex flex-col w-full max-w-md px-5 pt-[max(14px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] animate-rise transition-opacity duration-300',
          compact ? 'gap-2' : 'gap-3',
          // The polaroid takes over from the canvas, so everything here fades
          pinning && 'opacity-0 pointer-events-none',
        )}
      >
        <header className="flex flex-none items-center justify-between gap-3 min-h-10">
          {past ? (
            <>
              <PastByline {...past} />
              <CanvasSettingsButton />
            </>
          ) : (
            <>
              <DeskByline createdBy={dailyPrompt.createdBy} fit={fit} />
              <DeskLinks />
            </>
          )}
        </header>

        {/* Whatever height is left; the column inside sits in its middle */}
        <div
          ref={areaRef}
          className="flex flex-col justify-center flex-1 min-h-0"
        >
          <div
            ref={contentRef}
            className="flex flex-col"
            style={{ gap: GAP[fit] }}
          >
            <div className="flex flex-col gap-2">
              {!past && <UnfinishedDoodleButton className="self-start" />}
              {!past && <RedoButton className="self-start" />}
              {!past && christmas?.countdownDays && (
                <OrnamentTally event={christmas} />
              )}
              <PromptTitle
                prompt={dailyPrompt.prompt}
                colors={dailyPrompt.colors}
                className={cn(
                  compact && 'text-[clamp(24px,7.5vw,30px)] leading-[1]',
                )}
              />
            </div>

            <ZoomableCanvas
              zoomRef={zoomRef}
              pinchAreaRef={deskRef}
              size={size}
              backgroundColor={backgroundColor}
              // Hidden until it's been measured, so it never flashes the wrong size
              className={cn('self-center animate-drop', !size && 'invisible')}
            />

            {judge && (
              <div
                className={cn(
                  'flex gap-2',
                  compact ? 'items-center' : 'items-end',
                )}
              >
                <div className={cn('flex-1 min-w-0', !compact && 'h-[70px]')}>
                  <TodaysJudgeChip compact={compact} />
                </div>
                <JudgeIntroReplayButton className={cn(compact && 'size-9')} />
              </div>
            )}

            {compact ? (
              // The pin wraps under the tools when both won't fit (e.g. a
              // day with extra pencils), rather than sitting on top of them.
              // On a shared row the toolbar takes nearly all the spare room;
              // a wrapped pin grows to the full width.
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Toolbar
                  pencils={pencils}
                  compact
                  className="w-auto grow-[999]"
                />
                {submit}
              </div>
            ) : (
              <>
                <Toolbar pencils={pencils} />
                <div className="mt-1">{submit}</div>
              </>
            )}

            {error && <p className="text-center text-coral">{error}</p>}
          </div>
        </div>
      </main>
      {leaveGuard}
    </div>
  );
};

export default DrawingDesk;
