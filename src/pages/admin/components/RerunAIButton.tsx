import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { useApplyAIRun, useRerunAIReview } from '../api';
import { ApplyAIRunButton, RunSummary } from './ApplyAIRunButton';
import type { ApplicableRun } from './ApplyAIRunButton';
import type { FC } from 'react';
import { formatScore } from '@/ai/score';
import { cn } from '@/utils';
import { useConfirm } from '@/components/Confirm';

type Props = {
  submissionId: string;
  /** The judge to ask; leave it out for whoever reviewed it (or judges today) */
  personalityId?: string;
  /** Named in the confirmation, e.g. "Sir Doodleton" */
  judgeName?: string;
  /** Whose doodle it is, for the confirmation */
  artist?: string;
  /** Show "re-run" next to the icon */
  showLabel?: boolean;
  className?: string;
};

/**
 * Has a judge look at a doodle again, then asks whether to apply the new
 * review. Nothing changes for the player unless it's applied; either way the
 * run is in the AI log as an admin re-run, where it can be applied later.
 */
export const RerunAIButton: FC<Props> = ({
  submissionId,
  personalityId,
  judgeName,
  artist,
  showLabel = false,
  className,
}) => {
  const rerun = useRerunAIReview();
  const apply = useApplyAIRun();
  const confirm = useConfirm();

  async function run() {
    const who = judgeName ?? 'its judge';
    const whose = artist ? `${artist}'s` : 'this';
    const ok = await confirm({
      title: `have ${who} judge ${whose} doodle again?`,
      message:
        "you'll see the new review and choose whether to apply it. Until then the player keeps the old one.",
      confirmLabel: 're-run',
    });
    if (!ok) return;
    rerun.mutate(
      { submissionId, personalityId },
      {
        onSuccess: async ({ run: fresh }) => {
          const summary: ApplicableRun = { ...fresh, submissionId };
          const yes = await confirm({
            title: `apply ${fresh.judgeName}'s new review?`,
            message: <RunSummary run={summary} />,
            confirmLabel: 'apply',
            cancelLabel: 'keep the old one',
          });
          if (yes) apply.mutate({ id: fresh.id, submissionId });
        },
      },
    );
  }

  const fresh = rerun.data?.run;
  const busy = rerun.isPending || apply.isPending;

  return (
    <span
      className={cn('inline-flex flex-col items-start gap-0.5', className)}
      // Inside clickable rows: don't open the row too
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy}
        title="judge it again, then choose whether to apply it"
        aria-label={showLabel ? undefined : 're-run'}
        className="inline-flex items-center gap-1.5 text-pencil hover:text-ink disabled:opacity-40 cursor-pointer whitespace-nowrap"
        onClick={run}
      >
        <FontAwesomeIcon
          icon={faRotate}
          className={cn(rerun.isPending && 'animate-spin')}
        />
        {showLabel && (rerun.isPending ? 'judging…' : 're-run')}
      </button>
      {fresh && fresh.score !== null && (
        <span className="flex items-center gap-1.5 text-xs text-pencil whitespace-nowrap">
          {apply.isSuccess ? 'applied' : 'new'}: {formatScore(fresh.score)}/10
          {!apply.isSuccess && !apply.isPending && (
            <ApplyAIRunButton
              key={fresh.id}
              run={{ ...fresh, submissionId }}
              showLabel
            />
          )}
        </span>
      )}
      {(rerun.error ?? apply.error) && (
        <span className="text-xs text-coral">
          {(rerun.error ?? apply.error)?.message}
        </span>
      )}
    </span>
  );
};
