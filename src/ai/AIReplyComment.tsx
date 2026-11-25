import { AIJudgeAvatar } from './AIJudgeAvatar';
import type { FC } from 'react';
import type { AIReply } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { useAlert, useConfirm } from '@/components/Confirm';
import { TrashIcon } from '@/components/icons';
import { SpeechBox } from '@/components/SpeechBox';
import { MentionText } from '@/mentions/MentionText';
import { useDeleteAIReply } from '@/pages/admin/api';
import { timeAgo } from '@/utils';

type Props = { reply: AIReply; submissionId: string };

/** A judge chiming in again in the comments. Admins can take it back out. */
export const AIReplyComment: FC<Props> = ({ reply, submissionId }) => {
  const { isAdmin } = useUser();
  const deleteReply = useDeleteAIReply();
  const confirm = useConfirm();
  const alert = useAlert();

  async function remove() {
    const ok = await confirm({
      title: `delete ${reply.judge.name}'s reply?`,
      message: "it can't be undone.",
      confirmLabel: 'delete',
      cancelLabel: 'keep it',
    });
    if (!ok) return;
    deleteReply.mutate(
      { id: reply.id, submissionId },
      {
        onError: (err) =>
          alert({ title: "couldn't delete that", message: err.message }),
      },
    );
  }

  return (
    <SpeechBox
      portrait={<AIJudgeAvatar judge={reply.judge} />}
      name={reply.judge.name}
    >
      <div className="flex items-start gap-2 font-semibold leading-snug">
        <p className="flex-1 min-w-0 break-words">
          <MentionText text={reply.text} />
        </p>
        <span className="text-xs leading-5 text-secondary whitespace-nowrap">
          {timeAgo(reply.createdAt)}
        </span>
        {isAdmin && (
          <button
            type="button"
            aria-label={`Delete ${reply.judge.name}'s reply`}
            disabled={deleteReply.isPending}
            onClick={remove}
            className="grid place-items-center size-5 cursor-pointer text-pencil transition-[scale,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:text-ink active:scale-90 disabled:opacity-50"
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>
    </SpeechBox>
  );
};
