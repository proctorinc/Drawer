import { Card } from '@/components/Card';
import type { FC } from 'react';
import { DrawingImage } from './DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import type { UserPromptSubmission } from '@/api/Api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrow,
  faCrown,
  faFaceGrinTears,
  faHeart,
  faThumbsUp,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/Tooltip';
import Button from '@/components/Button';
import { cn } from '@/utils';
import { cva } from 'class-variance-authority';

type Props = {
  submission: UserPromptSubmission;
};

type ReactionId = 'heart' | 'cry-laugh' | 'crown' | 'thumbs-up' | 'borg';
type Reaction = {
  id: ReactionId;
  icon: IconDefinition;
};
type FriendReaction = {
  count: number;
} & Reaction;

const friendReactions: FriendReaction[] = [
  { id: 'heart', count: 2, icon: faHeart },
  { id: 'cry-laugh', count: 1, icon: faFaceGrinTears },
  { id: 'crown', count: 3, icon: faCrown },
  { id: 'thumbs-up', count: 4, icon: faThumbsUp },
  { id: 'borg', count: 1, icon: faCrow },
];

const reactions: Reaction[] = [
  { id: 'heart', icon: faHeart },
  { id: 'cry-laugh', icon: faFaceGrinTears },
  { id: 'crown', icon: faCrown },
  { id: 'thumbs-up', icon: faThumbsUp },
  { id: 'borg', icon: faCrow },
];

const DrawingFeedImage: FC<Props> = ({ submission }) => {
  return (
    <Card
      key={`${submission.user.id}-${submission.day}`}
      className="flex items-center relative bg-card rounded-2xl border-2 border-border"
    >
      <DrawingImage imageUrl={submission.imageUrl} className="rounded-2xl" />
      <ReactionButton />
      <div className="flex flex-col gap-2 absolute top-2 right-2">
        <UserProfileIcon showTooltip user={submission.user} />
        <FriendReactions />
      </div>
    </Card>
  );
};

const ReactionButton = () => {
  return (
    <Tooltip
      className="absolute bottom-2 left-2"
      // tooltipClassName="-ml-10"
      location="right"
      content={<TooltipContent />}
    >
      <div className="flex justify-center items-center h-12 w-12 rounded-full bg-base/50 text-primary hover:scale-110 transition-all duration-300">
        <FontAwesomeIcon icon={faHeart} />
      </div>
    </Tooltip>
  );
};

const reactionIndicatorVariants = cva(
  'z-20 bg-base gap-1 text-sm w-12 h-8 text-card-foreground rounded-full whitespace-nowrap transition-opacity duration-200 font-bold shadow-lg',
  {
    variants: {
      icon: {
        heart: 'text-red-500 bg-red-400/50',
        'cry-laugh': 'text-orange-500 bg-orange-400/50',
        crown: 'text-yellow-500 bg-yellow-400/50',
        'thumbs-up': 'text-blue-500 bg-blue-400/50',
        borg: 'text-purple-500 bg-purple-400/50',
      },
    },
    defaultVariants: {
      icon: 'heart',
    },
  },
);

type FriendReactionIndicatorProps = {
  data: FriendReaction;
};

const FriendReactionIndicator: FC<FriendReactionIndicatorProps> = ({
  data: reaction,
}) => {
  return (
    // <Tooltip
    //   // tooltipClassName="-ml-10"
    //   location="left"
    //   content={reaction.count}
    // >
    <Button
      disableLoad
      variant="base"
      size="sm"
      onClick={() => console.log('BORG')}
      className={cn(reactionIndicatorVariants({ icon: reaction.id }))}
    >
      {reaction.count > 1 && `${reaction.count} `}
      <FontAwesomeIcon icon={reaction.icon} />
    </Button>
    // </Tooltip>
  );
};

const FriendReactions = () => {
  return (
    <div className="flex flex-col gap-1 h-[500px]">
      {friendReactions.map((reaction) => (
        <FriendReactionIndicator data={reaction} />
      ))}
    </div>
  );
};

const TooltipContent = () => {
  return (
    <div className="flex px-3 py-2 gap-2">
      {reactions.map((reaction) => (
        <Button
          disableLoad
          variant="base"
          onClick={() => console.log('HEART')}
          className="text-red-500 bg-red-400/50 rounded-full w-12 h-12 hover:scale-110 transition-all duration-300"
        >
          <FontAwesomeIcon icon={reaction.icon} />
        </Button>
      ))}
      {/* <Button
        disableLoad
        variant="base"
        onClick={() => console.log('LAUGH')}
        className="text-orange-500 bg-orange-400/50 rounded-full w-12 h-12 hover:scale-110 transition-all duration-300"
      >
        <FontAwesomeIcon icon={faFaceGrinTears} />
      </Button>
      <Button
        disableLoad
        variant="base"
        onClick={() => console.log('CROWN')}
        className="text-yellow-500 bg-yellow-400/50 rounded-full w-12 h-12 hover:scale-110 transition-all duration-300"
      >
        <FontAwesomeIcon icon={faCrown} />
      </Button>
      <Button
        disableLoad
        variant="base"
        onClick={() => console.log('CROWN')}
        className="text-blue-500 bg-blue-400/50 rounded-full w-12 h-12 hover:scale-110 transition-all duration-300"
      >
        <FontAwesomeIcon icon={faThumbsUp} />
      </Button>
      <Button
        disableLoad
        variant="base"
        onClick={() => console.log('BORG')}
        className="text-purple-500 bg-purple-400/50 rounded-full w-12 h-12 hover:scale-110 transition-all duration-300"
      >
        <FontAwesomeIcon icon={faCrow} />
      </Button> */}
    </div>
  );
};

export default DrawingFeedImage;
