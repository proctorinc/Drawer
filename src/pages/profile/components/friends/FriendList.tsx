import { Card, CardContent, CardHeader } from '@/components/Card';
import { UserProfileIcon } from '../UserProfileIcon';
import { nameToColor } from '@/utils';
import Banner from '@/components/Banner';
import type { User } from '@/api/Api';
import type { FC } from 'react';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
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
        <CardHeader title="Friend list"></CardHeader>
        <div className="flex flex-col gap-2 w-full max-w-md">
          {friends?.length === 0 && (
            <Banner className="bg-base border-none p-4">No friends</Banner>
          )}
          {friends?.length === 0 && isMe && (
            <Banner className="bg-base border-none p-4">
              Share a link to add friends!
            </Banner>
          )}
          {friends &&
            friends.length > 0 &&
            friends.map((friend) => {
              const { primary, secondary, text } = nameToColor(friend.username);
              return (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-2xl w-full px-4 py-2"
                  style={{ backgroundColor: secondary }}
                >
                  <UserProfileIcon user={friend} />
                  <div className="flex justify-between items-center w-full">
                    <h3 className="text-primary font-bold">
                      @{friend.username}
                    </h3>
                    <Button
                      size="sm"
                      style={{ backgroundColor: primary, color: text }}
                      icon={faAngleRight}
                      onClick={() =>
                        navigate({ to: `/draw/profile/${friend.id}` })
                      }
                    ></Button>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
