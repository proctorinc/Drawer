import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { queryKeys, useAddComment } from '@/api/Api';
import { useAlert } from '@/components/Confirm';
import { CommentIcon } from '@/components/icons';

type Props = { submissionId: string };

/** A slim line to write a comment on, sent with the comment icon */
export const CommentComposer: FC<Props> = ({ submissionId }) => {
  const queryClient = useQueryClient();
  const addComment = useAddComment();
  const alert = useAlert();
  const [text, setText] = useState('');
  const canSend = !!text.trim() && !addComment.isPending;

  function send() {
    if (!canSend) return;
    addComment.mutate(
      { submissionId, text },
      {
        onSuccess: () => {
          for (const queryKey of [
            queryKeys.myProfile,
            queryKeys.promptSubmission(submissionId),
            queryKeys.activityFeed,
          ]) {
            queryClient.invalidateQueries({ queryKey });
          }
          refreshProgress(queryClient);
          setText('');
        },
        onError: (err) =>
          alert({ title: "couldn't post that", message: err.message }),
      },
    );
  }

  return (
    <form
      className="flex items-center gap-1 h-10 pl-3 pr-1 bg-white border-2 border-ink rounded-sketch-alt"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        className="flex-1 min-w-0 bg-transparent placeholder:text-pencil/70 focus:outline-none"
        placeholder="Add a comment..."
        aria-label="Your comment"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        aria-label="Post comment"
        disabled={!canSend}
        className="grid place-items-center size-8 cursor-pointer text-ink transition-[scale,opacity] duration-300 ease-[var(--ease-spring)] hover:scale-110 active:scale-90 disabled:opacity-30 disabled:cursor-default disabled:hover:scale-100"
      >
        <CommentIcon size={20} strokeWidth={2.2} />
      </button>
    </form>
  );
};
