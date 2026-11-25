import { useState } from 'react';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import type { FC } from 'react';
import type { AIJudge } from '@/api/Api';
import type { AIReplyDraft } from '@/pages/admin/api';
import Button from '@/components/Button';
import { useDraftAIReplies, usePostAIReplies } from '@/pages/admin/api';
import Sheet from '@/pages/profile/components/Sheet';
import { cn } from '@/utils';

type Props = { submissionId: string; judge: AIJudge };

/** A draft and whether the admin will post it */
type Pick = AIReplyDraft & { approved: boolean };

/**
 * Admin-only: has the doodle's judge chime in again in the comments. The
 * judge drafts one @reply per person it answers (following the direction, if
 * any); the admin crosses out the ones to skip, drafts again with new
 * direction, or posts the rest. Nothing is posted until they do.
 */
export const AIReplyButton: FC<Props> = ({ submissionId, judge }) => {
  const draftReplies = useDraftAIReplies();
  const postReplies = usePostAIReplies();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState('');
  const [picks, setPicks] = useState<Array<Pick>>([]);
  const approved = picks.filter((pick) => pick.approved);
  const busy = draftReplies.isPending || postReplies.isPending;
  const error = draftReplies.error ?? postReplies.error;

  function draft() {
    postReplies.reset();
    draftReplies.mutate(
      { submissionId, direction },
      {
        onSuccess: (drafts) =>
          setPicks(drafts.map((d) => ({ ...d, approved: true }))),
      },
    );
  }

  function toggle(index: number) {
    setPicks((all) =>
      all.map((pick, i) =>
        i === index ? { ...pick, approved: !pick.approved } : pick,
      ),
    );
  }

  function post() {
    postReplies.mutate(
      { submissionId, texts: approved.map((pick) => pick.text) },
      {
        onSuccess: () => {
          setPicks([]);
          setDirection('');
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="self-start flex items-center gap-1.5 ml-1 text-sm font-semibold text-secondary cursor-pointer hover:text-ink"
      >
        <AIJudgeAvatar judge={judge} size="xs" />
        AI response
      </button>
      <Sheet title="AI response" open={open} onClose={() => setOpen(false)}>
        <div className="flex items-center gap-3">
          <AIJudgeAvatar judge={judge} size="lg" />
          <p className="leading-snug">
            {judge.name} drafts a short reply to each person they answer.
            Nothing posts until you pick.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">Direction (optional)</span>
          <textarea
            rows={3}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            disabled={busy}
            placeholder={`Leave empty and ${judge.name} answers whoever talked to them or about the doodle`}
            className="px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt resize-none placeholder:text-pencil/70 focus:outline-none"
          />
        </label>
        <Button
          size="sm"
          variant={picks.length ? 'base' : 'primary'}
          disableLoad
          disabled={busy}
          onClick={draft}
        >
          {draftReplies.isPending
            ? `${judge.name} is typing…`
            : picks.length
              ? 'Redo drafts'
              : 'Draft replies'}
        </Button>

        {picks.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">Tap a reply to skip it</h3>
            <ul className="flex flex-col gap-2">
              {picks.map((pick, i) => (
                <li key={`${pick.to}-${i}`}>
                  <button
                    type="button"
                    aria-pressed={pick.approved}
                    disabled={busy}
                    onClick={() => toggle(i)}
                    className={cn(
                      'flex items-start gap-2.5 w-full px-3 py-2 text-left border-2 rounded-sketch-alt cursor-pointer transition-opacity',
                      pick.approved
                        ? 'bg-white border-ink'
                        : 'bg-transparent border-dashed border-line opacity-60',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid place-items-center size-5 flex-none mt-0.5 rounded-full border-2 border-ink text-xs font-bold',
                        pick.approved ? 'bg-ink text-paper' : 'bg-white',
                      )}
                    >
                      {pick.approved ? '✓' : '✕'}
                    </span>
                    <span
                      className={cn(
                        'flex-1 min-w-0 font-semibold leading-snug break-words',
                        !pick.approved && 'line-through',
                      )}
                    >
                      {pick.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error.message}
          </p>
        )}

        {picks.length > 0 && (
          <Button
            size="sm"
            disableLoad
            disabled={busy || approved.length === 0}
            onClick={post}
          >
            {postReplies.isPending
              ? 'Posting…'
              : approved.length === 1
                ? 'Post 1 reply'
                : `Post ${approved.length} replies`}
          </Button>
        )}
      </Sheet>
    </>
  );
};
