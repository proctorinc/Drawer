import { Card, CardContent, CardHeader } from '@/components/Card';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import Banner from '@/components/Banner';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import useUser from '@/auth/hooks/useUser';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from '@tanstack/react-router';

type Props = {
  user?: User;
  friends?: Array<User>;
};

export const FriendList: FC<Props> = ({ user, friends }) => {
  const currentUser = useUser();
  const navigate = useNavigate();

  const isMe = user?.id === currentUser.id;

  return (
    <Card>
      <CardContent>
        <CardHeader
          title={isMe ? 'My friends' : `${user?.username}'s friends`}
        />
        <div className="flex flex-col gap-2 w-full max-w-md stagger">
          {friends?.length === 0 && (
            <Banner className="bg-paper border-dashed">no friends yet</Banner>
          )}
          {friends &&
            friends.length > 0 &&
            friends.map((friend) => {
              return (
                <button
                  key={friend.id}
                  className="press flex items-center gap-3 w-full px-3 py-2 bg-white border-[1.5px] border-ink rounded-sketch-alt text-left cursor-pointer hover:-rotate-1"
                  onClick={() => navigate({ to: `/draw/profile/${friend.id}` })}
                >
                  <UserProfileIcon
                    size="sm"
                    user={friend}
                    onClick={() =>
                      navigate({ to: `/draw/profile/${friend.id}` })
                    }
                  />
                  <span className="flex-1 text-lg">{friend.username}</span>
                  <FontAwesomeIcon
                    icon={faAngleRight}
                    className="text-pencil"
                  />
                </button>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
