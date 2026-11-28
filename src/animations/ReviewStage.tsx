import { useEffect, useState } from 'react';
import { useAnimationQueue } from './AnimationQueue';
import type { StageComponent } from './types';
import { AIDialogue, stagedReviews } from '@/ai/AIDialogue';
import { shouldOfferTips } from '@/ai/ReviewTips';
import { usePromptSubmission } from '@/api/Api';

/**
 * An AI judge saying its review. Uses the review handed over when it was
 * queued; failing that (say, queued from the dev console) it looks it up, and
 * bows out if there's nothing to say.
 */
export const ReviewStage: StageComponent<'review'> = ({ payload, onDone }) => {
  const { submissionId } = payload;
  const [staged] = useState(() => stagedReviews.get(submissionId));
  const { data, isError } = usePromptSubmission(staged ? '' : submissionId);

  const fetched = data?.aiReview?.status === 'done' ? data.aiReview : null;
  const review = staged?.review ?? fetched;
  const doodle =
    staged?.doodle ??
    (data ? { prompt: data.prompt, imageUrl: data.imageUrl } : undefined);
  const nothingToSay = !staged && (isError || (!!data && !fetched));
  const { enqueue } = useAnimationQueue();

  useEffect(() => {
    if (nothingToSay) onDone();
  }, [nothingToSay, onDone]);

  if (!review) return null;
  const close = () => {
    onDone();
    // A low score: follow it with the judge's tips, so it ends on a way forward
    if (shouldOfferTips(review)) {
      void enqueue({
        id: `review-tips-${submissionId}`,
        kind: 'reviewTips',
        payload: { submissionId, judge: review.judge, welcome: true },
      });
    }
  };
  return <AIDialogue review={review} doodle={doodle} onClose={close} />;
};
