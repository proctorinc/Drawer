import { Link } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Banner from '@/components/Banner';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type Props = {
  user: User;
  friends: Array<User>;
};

export const FriendList: FC<Props> = ({ user, friends }) => {
  const currentUser = useUser();
  const isMe = user.id === currentUser.id;

  return (
    <Card>
      <CardContent>
        <CardHeader
          title={isMe ? 'my friends' : `${user.username}'s friends`}
          subtitle={`${friends.length} ${friends.length === 1 ? 'pal' : 'pals'}`}
        />
        <div className="flex flex-col gap-2 w-full stagger">
          {friends.length === 0 && (
            <Banner className="bg-paper border-dashed">
              {isMe ? 'no friends yet. send your link!' : 'no friends yet'}
            </Banner>
          )}
          {friends.map((friend) => (
            <Link
              key={friend.id}
              to="/draw/profile/$userId"
              params={{ userId: friend.id }}
              className="press flex items-center gap-3 w-full px-3 py-2 bg-white border-[1.5px] border-ink rounded-sketch-alt hover:-rotate-1"
            >
              <UserProfileIcon size="sm" user={friend} />
              <span className="flex-1 text-lg truncate">{friend.username}</span>
              <FontAwesomeIcon icon={faAngleRight} className="text-pencil" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
