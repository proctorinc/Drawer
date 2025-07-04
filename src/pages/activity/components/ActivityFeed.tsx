import { useEffect, useRef } from 'react';
import { Card } from '@/components/Card';
import { useActivityFeed, useMarkActivityRead } from '@/api/Api';
import {
  cn,
  getReactionIcon,
  reactionIndicatorVariants,
  timeAgo,
} from '@/utils';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import { useNavigate } from '@tanstack/react-router';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/components/Button';

export const ActivityFeed = () => {
  const navigate = useNavigate();
  const { data: activities, isLoading, isError } = useActivityFeed();
  const markActivityRead = useMarkActivityRead();
  const hasMarkedRead = useRef(false);

  // Mark as read after activities are fetched, only once
  useEffect(() => {
    if (
      activities &&
      activities.length > 0 &&
      !hasMarkedRead.current &&
      markActivityRead.status === 'idle'
    ) {
      const mostRecentId = activities[0].id;
      markActivityRead.mutate(mostRecentId);
      hasMarkedRead.current = true;
    }
  }, [activities, markActivityRead]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading activity...</div>;
  }
  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        Error loading activity.
      </div>
    );
  }
  if (!activities || activities.length === 0) {
    return (
      <Card className="h-64 justify-center text-center">
        <h2 className="text-primary-foreground font-bold text-xl">
          No Activity Yet
        </h2>
        <p className="font-bold text-secondary">
          Wait for a friend to comment or react!
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md pb-40">
      {activities.map((activity) => {
        const icon = activity.reaction
          ? getReactionIcon(activity.reaction?.reactionId)?.icon
          : null;

        return (
          <Card
            key={activity.id}
            className="flex items-start gap-3 p-4 relative"
            onClick={() =>
              navigate({ to: `/app/submission/${activity.submission.id}` })
            }
          >
            <div className="flex flex-col w-full">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-3 items-center">
                    <UserProfileIcon user={activity.user} size="sm" />
                    <span className="text-secondary font-bold">
                      {activity.action === 'comment' ? 'Commented' : 'Reacted'}
                      {' - '}
                      {timeAgo(activity.date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    {activity.action === 'comment' && activity.comment && (
                      <span className="font-semibold text-primary-foreground">
                        {activity.comment.text}
                      </span>
                    )}
                    {activity.action === 'reaction' && activity.reaction && (
                      <span className="flex gap-2 items-center text-primary-foreground">
                        Reacted with
                        <Button
                          disableLoad
                          variant="base"
                          size="sm"
                          className={cn(
                            'font-accent',
                            reactionIndicatorVariants({
                              icon: activity.reaction.reactionId,
                            }),
                          )}
                        >
                          {icon && <FontAwesomeIcon icon={icon} />}
                        </Button>
                      </span>
                    )}
                  </div>
                </div>
                <DrawingImage
                  imageUrl={activity.submission.imageUrl}
                  className="h-20 w-20 border-2 border-border"
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
