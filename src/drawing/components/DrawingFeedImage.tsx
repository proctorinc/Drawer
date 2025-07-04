import { Card } from '@/components/Card';
import type { FC } from 'react';
import { DrawingImage } from './DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import {
  queryKeys,
  useToggleSubmissionReaction,
  type ReactionCount,
  type ReactionId,
  type UserPromptSubmission,
} from '@/api/Api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFaceGrinSquintTears,
  faFaceMeh,
  faHeart,
  faFire,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/Tooltip';
import Button from '@/components/Button';
import { cn } from '@/utils';
import { cva } from 'class-variance-authority';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/pages/profile/UserProfileContext';

type Props = {
  submission: UserPromptSubmission;
};

type ReactionItem = {
  id: ReactionId;
  icon: IconDefinition;
};

const reactions: ReactionItem[] = [
  { id: 'heart', icon: faHeart },
  { id: 'cry-laugh', icon: faFaceGrinSquintTears },
  { id: 'fire', icon: faFire },
  { id: 'face-meh', icon: faFaceMeh },
];

function getReactionIcon(reactionId: string) {
  return reactions.find((reaction) => reaction.id === reactionId);
}

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
  return (
    <Card
      key={`${submission.user.id}-${submission.day}`}
      className="flex items-center relative bg-card rounded-2xl border-2 border-border"
    >
      <DrawingImage imageUrl={submission.imageUrl} className="rounded-xl" />
      <ReactionButton submission={submission} />
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

const reactionIndicatorVariants = cva(
  'z-20 bg-base gap-1 text-sm w-12 h-8 text-card-foreground rounded-full whitespace-nowrap transition-opacity duration-200 font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]',
  {
    variants: {
      icon: {
        heart: 'text-red-500/50 bg-red-400/40 shadow-red-500/50',
        'cry-laugh': 'text-blue-600/50 bg-blue-400/40 shadow-blue-500/50',
        fire: 'text-orange-600/50 bg-orange-400/40 shadow-orange-500/50',
        'face-meh': 'text-purple-600/50 bg-purple-400/40 shadow-purple-500/50',
      },
    },
    defaultVariants: {
      icon: 'heart',
    },
  },
);

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
    <div className="flex flex-col gap-1 h-[500px]">
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
            disableLoad
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
                  },
                },
              );
            }}
            className={cn(
              'bg-border/50 text-primary/50',
              isActive && reactionIndicatorVariants({ icon: reaction.id }),
              'rounded-full h-12 w-12 text-xl',
            )}
          >
            <FontAwesomeIcon icon={reaction.icon} />
          </Button>
        );
      })}
    </div>
  );
};

export default DrawingFeedImage;
