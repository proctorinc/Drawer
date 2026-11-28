import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { commentThread } from '../commentRuns';
import { CommentComposer } from './CommentComposer';
import { CommentReactions } from './CommentReactions';
import { PinButton } from './PinButton';
import type { FC } from 'react';
import type { Comment, ReactionId, UserPromptSubmission } from '@/api/Api';
import { SpeechBox } from '@/components/SpeechBox';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { AIReviewComment } from '@/ai/AIReviewComment';
import { AIReplyButton } from '@/ai/AIReplyButton';
import { AIReplyComment } from '@/ai/AIReplyComment';
import {
  queryKeys,
  useDeleteComment,
  useGetMyProfile,
  useGetRedos,
  usePromptSubmission,
  useToggleCommentReaction,
} from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { useAlert, useConfirm } from '@/components/Confirm';
import { HeartIcon, LockIcon, RedoIcon, TrashIcon } from '@/components/icons';
import { ReactionDrawer } from '@/reactions/ReactionDrawer';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { PIN_COLORS, PushPin } from '@/components/PushPin';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { isSameDay, parseDay } from '@/days';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';
import { ShareButton } from '@/pages/profile/components/friends/ShareButton';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ReactionBar } from '@/reactions/ReactionBar';
import { bigPolaroidFrameClass } from '@/components/polaroid';
import { cn, timeAgo } from '@/utils';
import { GoldTrim, goldFrameClass, isMasterpiece } from '@/ai/Masterpiece';
import { CleanText } from '@/moderation/CleanText';
import { mentionables } from '@/mentions/mentions';

/** A pin color that varies page to page but stays put for a given doodle */
function pinColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PIN_COLORS[Math.abs(hash) % PIN_COLORS.length];
}

/**
 * In place of the comment box on a drawing you can't see yet: draw the day
 * yourself (with a redo, for a missed one) and it opens up
 */
const LockedNote: FC<{ day: string }> = ({ day }) => {
  const { data: redos } = useGetRedos();
  const redoable = redos?.prompts.some((prompt) => isSameDay(prompt.day, day));
  const linkClass =
    'press inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm text-base leading-none text-ink';

  return (
    <div className="flex flex-col items-center gap-2.5 mt-3 px-4 py-4 border-2 border-dashed border-line rounded-sketch text-center text-pencil">
      <LockIcon
        size={28}
        fill="var(--color-me)"
        className="text-ink -rotate-6"
      />
      <p className="text-balance leading-snug">
        draw this prompt yourself to see it, the judge's take, and join in
      </p>
      {redoable ? (
        <Link
          to="/draw/redo/$day"
          params={{ day: day.slice(0, 10) }}
          className={linkClass}
        >
          <RedoIcon size={15} />
          redo this day
        </Link>
      ) : (
        <Link to="/draw" className={linkClass}>
          draw it now
        </Link>
      )}
    </div>
  );
};

type Props = {
  /** The feed's copy shows straight away; the full doodle loads over it */
  doodle: UserPromptSubmission;
};

/** One doodle's whole page: the pinned polaroid, its prompt and the comments */
const SubmissionSheet: FC<Props> = ({ doodle }) => {
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleCommentReaction();
  const isDrawingLocked = useIsDrawingLocked();
  const { data: submission = doodle } = usePromptSubmission(doodle.id, doodle);
  const locked = isDrawingLocked(submission);
  // A perfect 10 is framed in gold, once you can see it
  const golden = !locked && isMasterpiece(submission);
  const deleteComment = useDeleteComment();
  const confirm = useConfirm();
  const alert = useAlert();
  const { data: me } = useGetMyProfile();
  // Who typing @ suggests: the judge, the artist, everyone here, your friends
  const canMention = mentionables(
    submission.aiReview?.judge,
    [
      submission.user,
      ...submission.comments.map((comment) => comment.user),
      ...(me?.friends ?? []),
    ],
    currentUser.id,
  );

  // The comment whose reaction drawer is open, if any
  const [reactingTo, setReactingTo] = useState<Comment | null>(null);

  function myReaction(comment: Comment) {
    return comment.reactions.find(
      (reaction) => reaction.user.id === currentUser.id,
    )?.reactionId;
  }

  function reactToComment(comment: Comment, reactionId: ReactionId) {
    toggleReaction.mutate(
      {
        submissionId: submission.id,
        commentId: comment.id,
        reactionId,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.promptSubmission(submission.id),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.activityFeed,
          });
          refreshProgress(queryClient);
        },
      },
    );
  }

  async function removeComment(comment: Comment) {
    const ok = await confirm({
      title: 'delete your comment?',
      message: "it can't be undone.",
      confirmLabel: 'delete',
      cancelLabel: 'keep it',
    });
    if (!ok) return;
    deleteComment.mutate(
      { submissionId: submission.id, commentId: comment.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.promptSubmission(submission.id),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
          refreshProgress(queryClient);
        },
        onError: (err) =>
          alert({ title: "couldn't delete that", message: err.message }),
      },
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full px-2 animate-drop [--tilt:-1deg] -rotate-1">
        <PushPin
          color={pinColor(submission.id)}
          size={40}
          className="absolute z-10 -top-[30px] left-1/2 -ml-5"
        />
        <div
          className={cn(
            'relative p-3',
            golden ? goldFrameClass : bigPolaroidFrameClass,
          )}
        >
          {golden && <GoldTrim size="lg" label />}
          <div className="relative">
            <DrawingFeedImage
              submission={submission}
              showAvatar={false}
              className="border-0 rounded-none shadow-none"
            />
            {/* As on the wall, starring your own sits on the photo's corner */}
            {submission.user.id === currentUser.id && (
              <PinButton submission={submission} variant="corner" />
            )}
          </div>
          {/* Whose it is, what it was meant to be and when */}
          <div className="flex items-center gap-3 mt-3">
            <UserProfileIcon
              user={submission.user}
              size="sm"
              className="flex-none"
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-accent font-bold text-[26px] leading-none text-balance">
                {submission.prompt}
              </h2>
              <p className="text-sm text-pencil">
                {parseDay(submission.day).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {/* Pinned the next day: the prompt rolled over mid-doodle */}
                {submission.late && ' · finished late'}
                {submission.redo && ' · redo'}
              </p>
            </div>
            <ShareButton
              className="flex-none"
              imageUrl={locked ? undefined : submission.imageUrl}
              text={`Checkout ${submission.user.id === currentUser.id ? 'my' : `${submission.user.username}'s`} doodle of ${submission.prompt.toLowerCase()}!`}
            />
          </div>
        </div>
      </div>
      {/* Just the reactions, each with its reactor's face on the corner */}
      <ReactionBar
        submission={submission}
        readOnly={locked}
        className="w-full px-2"
      />
      <ReactionDrawer
        title="react to comment"
        open={!!reactingTo}
        onClose={() => setReactingTo(null)}
        reactions={reactingTo?.reactions ?? []}
        counts={reactingTo?.counts ?? []}
        onToggle={(id) => reactingTo && reactToComment(reactingTo, id)}
      />
      <div className="flex flex-col w-full gap-2.5">
        {/* The AI judge's verdict leads the comments */}
        {submission.aiReview && !locked && (
          <AIReviewComment
            review={submission.aiReview}
            mine={submission.user.id === currentUser.id}
            className="mt-3"
          />
        )}
        {commentThread(
          submission.comments,
          locked ? undefined : submission.aiReplies,
        ).map((run) =>
          'reply' in run ? (
            <AIReplyComment
              key={run.reply.id}
              reply={run.reply}
              submissionId={submission.id}
            />
          ) : (
            <SpeechBox
              key={run.comments[0].id}
              portrait={<UserProfileIcon size="sm" user={run.user} />}
              name={run.user.username}
              mine={run.user.id === currentUser.id}
            >
              {run.comments.map((comment) => {
                const mine = myReaction(comment);

                return (
                  <div key={comment.id} className="flex flex-col gap-1">
                    <div className="flex items-start gap-2 font-semibold leading-snug">
                      <p className="flex-1 min-w-0 break-words">
                        <CleanText
                          text={comment.text}
                          judge={submission.aiReview?.judge.name ?? null}
                        />
                      </p>
                      <span className="text-xs leading-5 text-secondary whitespace-nowrap">
                        {timeAgo(comment.createdAt)}
                      </span>
                      {comment.user.id === currentUser.id ? (
                        <button
                          type="button"
                          aria-label="Delete your comment"
                          disabled={deleteComment.isPending}
                          onClick={() => removeComment(comment)}
                          className="grid place-items-center size-5 cursor-pointer text-pencil transition-[scale,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:text-ink active:scale-90 disabled:opacity-50"
                        >
                          <TrashIcon size={16} />
                        </button>
                      ) : locked ? null : (
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={
                            mine ? 'Change your reaction' : 'React to comment'
                          }
                          onClick={() => setReactingTo(comment)}
                          className="grid place-items-center size-5 cursor-pointer transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-110 active:scale-90"
                        >
                          {mine ? (
                            <ReactionSticker reactionId={mine} size={20} />
                          ) : (
                            <HeartIcon size={15} strokeWidth={2.2} />
                          )}
                        </button>
                      )}
                    </div>
                    {comment.reactions.length > 0 && (
                      <CommentReactions reactions={comment.reactions} />
                    )}
                  </div>
                );
              })}
            </SpeechBox>
          ),
        )}
        {submission.aiReplyPending && submission.aiReview && !locked && (
          <SpeechBox
            portrait={<AIJudgeAvatar judge={submission.aiReview.judge} />}
            name={submission.aiReview.judge.name}
          >
            <p
              className="font-semibold text-secondary animate-pulse"
              aria-live="polite"
            >
              typing…
            </p>
          </SpeechBox>
        )}
        {locked ? (
          <LockedNote day={submission.day} />
        ) : (
          <>
            {submission.comments.length === 0 && !submission.aiReview && (
              <span className="font-bold text-center text-secondary">
                Be the first to comment!
              </span>
            )}
            <CommentComposer
              submissionId={submission.id}
              mentionables={canMention}
            />
          </>
        )}
        {!locked &&
          currentUser.isAdmin &&
          submission.aiReview?.status === 'done' && (
            <AIReplyButton
              submissionId={submission.id}
              judge={submission.aiReview.judge}
            />
          )}
      </div>
      <div className="text-left w-full -mt-4">
        <span className="text-xs font-semibold text-secondary pl-2">
          Drawn at{' '}
          {new Date(submission.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
};

export default SubmissionSheet;
