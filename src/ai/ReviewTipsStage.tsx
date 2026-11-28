import '@/animations/completed/completed.css';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { ReviewTipsList, useReviewTips } from './ReviewTips';
import type { StageComponent } from '@/animations/types';
import { useStageHost } from '@/animations/StageHost';
import { useStageExit } from '@/animations/completed/useStageExit';
import Button from '@/components/Button';

/**
 * The judge's tips for your doodle, in a centered card. When it opens on its
 * own after a low score (`welcome`), it opens with a few kind words first, so
 * it reads as a helping hand rather than a second telling-off.
 */
export const ReviewTipsStage: StageComponent<'reviewTips'> = ({
  payload,
  onDone,
}) => {
  const { submissionId, judge, welcome } = payload;
  const { host } = useStageHost();
  const { leaving, exit } = useStageExit(onDone);
  const titleId = useId();
  const { data: tips, isPending } = useReviewTips(submissionId);

  // Nothing to show: let the next thing in line have its turn
  const nothing = !isPending && !tips;
  useEffect(() => {
    if (nothing) onDone();
  }, [nothing, onDone]);
  if (!tips) return null;

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
        className="completed-card relative w-full max-w-[22rem]"
        data-leaving={leaving || undefined}
      >
        <div className="completed-card-body flex flex-col gap-4 max-h-[85dvh] overflow-y-auto px-5 pt-5 pb-6 bg-white border-2 border-ink rounded-sketch shadow-pencil">
          <header className="flex items-center gap-3">
            <AIJudgeAvatar judge={judge} />
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-pencil">
                tips from {judge.name}
              </span>
              <h2
                id={titleId}
                className="font-accent font-bold text-3xl leading-none"
              >
                {welcome ? 'a few ideas for next time' : 'how to improve'}
              </h2>
            </div>
          </header>
          {welcome && (
            <p className="leading-snug">
              Every artist has doodles that don't land, and that's how you get
              better! Here are a few easy things to try on your next one.
            </p>
          )}
          <ReviewTipsList tips={tips} judge={judge} />
          <Button size="sm" disableLoad onClick={exit}>
            {welcome ? "thanks, I'll try!" : 'got it'}
          </Button>
        </div>
      </div>
    </div>,
    host,
  );
};

export default ReviewTipsStage;
