import { Card } from '@/components/Card';
import type { FC } from 'react';
import { DrawingImage } from './DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import {
  queryKeys,
  useToggleSubmissionReaction,
  type ReactionCount,
  type UserPromptSubmission,
} from '@/api/Api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/Tooltip';
import Button from '@/components/Button';
import {
  cn,
  getReactionIcon,
  reactionIndicatorVariants,
  reactions,
} from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/pages/profile/UserProfileContext';

type Props = {
  submission: UserPromptSubmission;
};

function hasUserReacted(
  submission: UserPromptSubmission,
  reactionId: string,
  userId: string,
) {
  return submission.reactions.some(
    (reaction) =>
      reaction.user.id === userId && reaction.reactionId === reactionId,
  );
}

function hasUserReactedAny(submission: UserPromptSubmission, userId: string) {
  return submission.reactions.some((reaction) => reaction.user.id === userId);
}

const DrawingFeedImage: FC<Props> = ({ submission }) => {
  const { userProfile } = useProfile();

  return (
    <Card
      key={`${submission.user.id}-${submission.day}`}
      className="flex items-center relative bg-card rounded-2xl border-2 border-border"
    >
      <DrawingImage imageUrl={submission.imageUrl} className="rounded-xl" />
      {submission.user.id !== userProfile?.user.id && (
        <ReactionButton submission={submission} />
      )}
      <div className="flex flex-col gap-2 absolute top-2 right-2">
        <UserProfileIcon showTooltip user={submission.user} />
        <FriendReactions submission={submission} />
      </div>
    </Card>
  );
};

type ReactionButtonProps = {
  submission: UserPromptSubmission;
};

const ReactionButton: FC<ReactionButtonProps> = ({ submission }) => {
  const { userProfile } = useProfile();

  if (!userProfile) {
    return <></>;
  }

  return (
    <div className="absolute bottom-2 left-2">
      <Tooltip
        location="right"
        content={<TooltipContent submission={submission} />}
      >
        <div
          className={cn(
            'flex justify-center items-center text-xl h-12 w-12 rounded-full bg-base/80 text-primary/50 hover:scale-110 transition-all duration-300',
            hasUserReactedAny(submission, userProfile?.user.id) &&
              'text-red-400/50 bg-red-200/50',
          )}
        >
          <FontAwesomeIcon icon={faHeart} />
        </div>
      </Tooltip>
    </div>
  );
};

type FriendReactionIndicatorProps = {
  data: ReactionCount;
};

const FriendReactionIndicator: FC<FriendReactionIndicatorProps> = ({
  data: reaction,
}) => {
  const icon = getReactionIcon(reaction.reactionId)?.icon;
  return (
    <Button
      disableLoad
      variant="base"
      size="sm"
      className={cn(
        'font-accent',
        reactionIndicatorVariants({ icon: reaction.reactionId }),
      )}
    >
      {reaction.count}
      {icon && <FontAwesomeIcon icon={icon} />}
    </Button>
  );
};

type FriendReactionsProps = {
  submission: UserPromptSubmission;
};

const FriendReactions: FC<FriendReactionsProps> = ({ submission }) => {
  return (
    <div className="flex flex-col gap-1">
      {submission.counts.map((reactionCounts) => (
        <FriendReactionIndicator data={reactionCounts} />
      ))}
    </div>
  );
};

type TooltipContentProps = {
  submission: UserPromptSubmission;
};

const TooltipContent: FC<TooltipContentProps> = ({ submission }) => {
  const toggleReaction = useToggleSubmissionReaction();
  const queryClient = useQueryClient();
  const { userProfile } = useProfile();

  if (!userProfile) {
    return <></>;
  }

  return (
    <div className="flex px-3 py-2 gap-2">
      {reactions.map((reaction) => {
        const isActive = hasUserReacted(
          submission,
          reaction.id,
          userProfile.user.id,
        );
        return (
          <Button
            variant="base"
            onClick={() => {
              console.log();
              toggleReaction.mutate(
                {
                  submissionId: submission.id,
                  reactionId: reaction.id,
                },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.userProfile,
                    });
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.promptSubmission(submission.id),
                    });
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.activityFeed,
                    });
                  },
                },
              );
            }}
            className={cn(
              'bg-border/50 text-primary/50',
              isActive && reactionIndicatorVariants({ icon: reaction.id }),
              'rounded-full h-12 w-12 text-xl',
            )}
            icon={reaction.icon}
          ></Button>
        );
      })}
    </div>
  );
};

export default DrawingFeedImage;
