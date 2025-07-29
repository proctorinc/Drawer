import type { Achievement } from '@/api/Api';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';
import {
  faAward,
  faCheckCircle,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { FC } from 'react';

type Props = {
  achievement: Achievement;
};

const AchievementCard: FC<Props> = ({ achievement }) => {
  const isAchieved = achievement.achievedAt !== null;

  return (
    <Card>
      <CardContent className="py-2 gap-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex w-full h-full min-h-14">
            <div className="flex flex-grow gap-3 items-center">
              {!isAchieved && (
                <FontAwesomeIcon
                  icon={faAward}
                  className="text-4xl text-secondary"
                />
              )}
              {isAchieved && (
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className={cn('text-4xl text-emerald-500')}
                />
              )}
              <div className="flex flex-col items-start">
                <div className="flex flex-col min-h-9">
                  <h3 className="flex gap-2 font-bold items-center text-primary">
                    {achievement.name}
                  </h3>
                  <h4 className="text-xs text-secondary font-semibold">
                    {achievement.description}
                  </h4>
                </div>
              </div>
            </div>
          </div>
          <h3
            className={cn(
              'text-lg font-semibold whitespace-nowrap text-secondary',
              isAchieved && 'text-primary-foreground',
            )}
          >
            {isAchieved ? (
              achievement.achievementValue
            ) : (
              <FontAwesomeIcon icon={faClock} />
            )}
            /{achievement.achievementValue}
          </h3>
          {/* {achievement.imageUrl !== '' && (
            <DrawingImage
              imageUrl={achievement.imageUrl}
              className="h-14 w-14 rounded-lg border-2 border-border"
            />
          )} */}
        </div>
        <div className="flex flex-col gap-1 text-xs text-secondary">
          {achievement.reward && (
            <span className="text-primary font-bold">
              Reward: {achievement.reward.name}
            </span>
          )}
          {achievement.achievedAt && (
            <span className="font-semibold">
              Completed:{' '}
              {new Date(achievement.achievedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AchievementCard;
