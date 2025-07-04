import { Card, CardContent, CardHeader } from '@/components/Card';
import { useProfile } from '../../UserProfileContext';
import { UserProfileIcon } from '../UserProfileIcon';
import { ShareButton } from './ShareButton';
import { nameToColor } from '@/utils';
import Banner from '@/components/Banner';

export const FriendList = () => {
  const { userProfile } = useProfile();

  return (
    <Card>
      <CardContent>
        <CardHeader title="Friend list" subtitle="My friends">
          <ShareButton />
        </CardHeader>
        <div className="flex flex-col gap-2 w-full max-w-md">
          {userProfile?.friends.length === 0 && (
            <Banner className="bg-base border-none p-4">
              Share a link to add friends!
            </Banner>
          )}
          {userProfile &&
            userProfile.friends.length > 0 &&
            userProfile.friends.map((friend) => {
              const { secondary } = nameToColor(friend.username);
              return (
                <div
                  className="flex items-center gap-2 rounded-2xl w-full px-4 py-2"
                  style={{ backgroundColor: secondary }}
                >
                  <UserProfileIcon user={friend} size="sm" />
                  <h3 className="font-accent tracking-widest text-primary font-bold">
                    {friend.username}
                  </h3>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
