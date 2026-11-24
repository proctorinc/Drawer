import type { FC } from 'react';
import type { Reaction } from '@/api/Api';
import { getReaction } from '@/reactions/catalog';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type Props = { reactions: Array<Reaction> };

/** Each reaction on a comment: its sticker, with the face of who left it on the corner */
export const CommentReactions: FC<Props> = ({ reactions }) => (
  <ul className="flex flex-wrap gap-x-2.5 gap-y-1.5">
    {reactions.map((reaction) => (
      <li
        key={reaction.id}
        aria-label={`${getReaction(reaction.reactionId).label} from ${reaction.user.username}`}
        className="relative mr-1.5"
      >
        <ReactionSticker reactionId={reaction.reactionId} size={28} />
        <span className="absolute -bottom-1 -right-1.5 scale-[0.7] origin-bottom-right">
          <UserProfileIcon user={reaction.user} size="xs" showLevel={false} />
        </span>
      </li>
    ))}
  </ul>
);
