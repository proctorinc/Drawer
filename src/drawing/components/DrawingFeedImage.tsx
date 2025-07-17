import { Card } from '@/components/Card';
import type { FC } from 'react';
import { DrawingImage } from './DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import {
  queryKeys,
  useToggleSubmissionFavorite,
  useToggleSubmissionReaction,
  type ReactionCount,
  type UserPromptSubmission,
} from '@/api/Api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/Tooltip';
import Button from '@/components/Button';
import {
  cn,
  getReactionIcon,
  reactionIndicatorVariants,
  reactions,
} from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import useUser from '@/auth/hooks/useUser';
import { useState, useRef } from 'react';

type Props = {
  submission: UserPromptSubmission;
  className?: string;
  onClick?: () => void;
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

const LONG_PRESS_DURATION = 200; // ms

const DrawingFeedImage: FC<Props> = ({ submission, onClick, className }) => {
  const user = useUser();
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Handlers for pointer events
  const handlePointerDown = () => {
    longPressTriggered.current = false;
    longPressTimeout.current = setTimeout(() => {
      setOverlaysVisible(false);
      longPressTriggered.current = true;
    }, LONG_PRESS_DURATION);
  };

  const handlePointerUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (longPressTriggered.current) {
      setOverlaysVisible(true);
      // Don't trigger click
    } else {
      // Trigger click if not a long press
      onClick?.();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (e.pointerType !== 'touch') {
      setOverlaysVisible(true);
    }
  };

  return (
    <Card
      key={`${submission.user.id}-${submission.day}`}
      className={cn(
        'flex items-center relative bg-card rounded-2xl border-2 border-border select-none',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
    >
      <DrawingImage
        imageUrl={submission.imageUrl}
        className={cn(
          'rounded-xl select-none',
          !overlaysVisible && 'pointer-events-none',
        )}
        draggable={false}
      />
      {/* Unified overlays container */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-200',
          !overlaysVisible && 'opacity-0 pointer-events-none',
        )}
        style={{ zIndex: 2 }}
      >
        {/* Reaction or Favorite button */}
        {submission.user.id !== user.id && (
          <div className="absolute bottom-2 left-2 pointer-events-auto">
            <ReactionButton submission={submission} />
          </div>
        )}
        {submission.user.id === user.id && (
          <div className="absolute bottom-2 right-2 pointer-events-auto">
            <FavoriteButton submission={submission} />
          </div>
        )}
        {/* Top right overlays */}
        <div
          id="hoverings"
          className="flex flex-col gap-2 absolute top-2 right-2 pointer-events-auto"
        >
          <UserProfileIcon user={submission.user} />
          <FriendReactions submission={submission} />
        </div>
      </div>
    </Card>
  );
};

type ReactionButtonProps = {
  submission: UserPromptSubmission;
};

const ReactionButton: FC<ReactionButtonProps> = ({ submission }) => {
  const user = useUser();

  return (
    <div className="absolute bottom-2 left-2">
      <Tooltip
        location="right"
        content={<TooltipContent submission={submission} />}
      >
        <div
          className={cn(
            'flex justify-center items-center text-xl h-12 w-12 rounded-full bg-base/90 text-primary/80 hover:scale-110 transition-all duration-300',
            hasUserReactedAny(submission, user.id) &&
              'text-red-400/80 bg-red-200/90',
          )}
        >
          <FontAwesomeIcon icon={faHeart} />
        </div>
      </Tooltip>
    </div>
  );
};

const FavoriteButton: FC<ReactionButtonProps> = ({ submission }) => {
  const queryClient = useQueryClient();
  const favoriteSubmission = useToggleSubmissionFavorite();

  return (
    <div className="absolute bottom-2 right-2">
      <div
        className={cn(
          'flex justify-center items-center text-xl h-12 w-12 rounded-full bg-base/90 text-primary/80 hover:scale-110 transition-all duration-300',
          submission.isFavorite && 'text-yellow-600/80 bg-yellow-300/90',
        )}
        onClick={() =>
          favoriteSubmission.mutate(submission.id, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.daily });
              queryClient.invalidateQueries({
                queryKey: queryKeys.activityFeed,
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.myProfile,
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.promptSubmission(submission.id),
              });
            },
          })
        }
      >
        <FontAwesomeIcon icon={faStar} />
      </div>
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
        <FriendReactionIndicator
          key={reactionCounts.reactionId}
          data={reactionCounts}
        />
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
  const user = useUser();

  return (
    <div className="flex px-3 py-2 gap-2">
      {reactions.map((reaction) => {
        const isActive = hasUserReacted(submission, reaction.id, user.id);
        return (
          <Button
            key={reaction.id}
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
                      queryKey: queryKeys.myProfile,
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
