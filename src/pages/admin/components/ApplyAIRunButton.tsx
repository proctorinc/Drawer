import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useApplyAIRun } from '../api';
import type { FC, ReactNode } from 'react';
import { AI_SCORE_MAX, formatScore } from '@/ai/score';
import { cn } from '@/utils';
import { useConfirm } from '@/components/Confirm';

/** What a confirmation needs to say about a run */
export type ApplicableRun = {
  id: string;
  submissionId: string;
  judgeName: string;
  score: number | null;
  comment: string;
};

/** The run's score and comment, for a confirmation */
export const RunSummary: FC<{ run: ApplicableRun; note?: ReactNode }> = ({
  run,
  note,
}) => (
  <span className="flex flex-col gap-2 text-left">
    <span className="font-accent font-bold text-2xl">
      {run.score !== null ? formatScore(run.score) : '–'}/{AI_SCORE_MAX}
    </span>
    <span>“{run.comment}”</span>
    <span className="text-sm text-pencil">
      it replaces the review the player sees (the bell shows it as new and the
      judge's dialogue plays again). The old run stays in the AI log.
    </span>
    {note && <span className="text-sm text-coral">{note}</span>}
  </span>
);

type Props = {
  run: ApplicableRun;
  /** Warned about in the confirmation, e.g. an unsaved prompt edit */
  note?: ReactNode;
  /** Show "apply" next to the icon */
  showLabel?: boolean;
  className?: string;
};

/**
 * Makes a logged re-run or testing-ground run the doodle's official review,
 * after asking.
 */
export const ApplyAIRunButton: FC<Props> = ({
  run,
  note,
  showLabel = false,
  className,
}) => {
  const apply = useApplyAIRun();
  const confirm = useConfirm();

  async function go() {
    const ok = await confirm({
      title: `apply ${run.judgeName}'s review to this doodle?`,
      message: <RunSummary run={run} note={note} />,
      confirmLabel: 'apply',
      cancelLabel: 'not now',
    });
    if (ok) apply.mutate({ id: run.id, submissionId: run.submissionId });
  }

  if (apply.isSuccess) {
    return (
      <span className={cn('text-xs text-ink whitespace-nowrap', className)}>
        <FontAwesomeIcon icon={faCheck} /> applied
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex flex-col items-start gap-0.5', className)}
      // Inside clickable rows: don't open the row too
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={apply.isPending}
        title="make this the review the player sees"
        aria-label={showLabel ? undefined : 'apply'}
        className="inline-flex items-center gap-1.5 text-pencil hover:text-ink disabled:opacity-40 cursor-pointer whitespace-nowrap"
        onClick={go}
      >
        <FontAwesomeIcon icon={faCheck} />
        {showLabel && (apply.isPending ? 'applying…' : 'apply')}
      </button>
      {apply.error && (
        <span className="text-xs text-coral">{apply.error.message}</span>
      )}
    </span>
  );
};
