import { useEffect, useState } from 'react';
import type { StageComponent } from './types';
import { AIDialogue, stagedReviews } from '@/ai/AIDialogue';
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

  useEffect(() => {
    if (nothingToSay) onDone();
  }, [nothingToSay, onDone]);

  if (!review) return null;
  return <AIDialogue review={review} doodle={doodle} onClose={onDone} />;
};
