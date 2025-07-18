import { Card, CardContent } from '@/components/Card';
import { useActivityFeed } from '@/api/Api';
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

  if (isLoading) {
    return <></>;
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
          <Card key={activity.id}>
            <CardContent className="p-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex w-full h-full min-h-14">
                  <div className="flex flex-grow gap-3 items-center pl-2">
                    <UserProfileIcon user={activity.user} size="sm" />
                    <div className="flex flex-col items-start">
                      <div className="flex items-center min-h-9">
                        {activity.action === 'comment' && activity.comment && (
                          <p className="font-semibold text-primary mb-1">
                            {activity.comment.text}
                          </p>
                        )}
                        {activity.action === 'reaction' &&
                          activity.reaction && (
                            <span className="flex gap-2 font-semibold items-center text-primary">
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
                      <span className="text-xs text-secondary font-bold">
                        {timeAgo(activity.date)}
                      </span>
                    </div>
                  </div>
                </div>
                <DrawingImage
                  imageUrl={activity.submission?.imageUrl ?? ''}
                  className="h-14 w-14 rounded-lg border-2 border-border"
                  onClick={() =>
                    navigate({
                      to: `/draw/submission/${activity.submission?.id}`,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
