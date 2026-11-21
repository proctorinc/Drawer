import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useProfile } from './context/UserProfileContext';
import { useGetUserAchievements } from './api';
import { FriendHeader } from './components/FriendTrophies';
import ProfileStats from './components/ProfileStats';
import Sheet from './components/Sheet';
import Sketchbook from './components/Sketchbook';
import StickerBook from './components/StickerBook';
import { FriendList } from './components/friends/FriendList';
import FriendshipButton from './components/friends/FriendshipButton';
import { ShareButton } from './components/friends/ShareButton';
import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import { PencilIcon } from '@/components/icons';
import FriendEventLink from '@/events/christmas/FriendEventLink';

/** Where a broken or out-of-date profile link lands */
const MissingBook = () => (
  <Layout back>
    <div className="flex flex-col items-center gap-3 w-full px-6 py-10 bg-white border-2 border-dashed border-ink rounded-sketch text-center">
      <PencilIcon size={36} className="-rotate-12" />
      <h1 className="font-accent font-bold text-[28px] leading-none">
        no book here!
      </h1>
      <p className="text-pencil">
        this link doesn't match anyone. maybe they changed it, or it got
        smudged.
      </p>
      <Link
        to="/draw/profile/me"
        className="press px-4 py-2 bg-me border-2 border-ink rounded-sketch-alt shadow-pencil-sm"
      >
        back to my book
      </Link>
    </div>
  </Layout>
);

/** Someone else's sketchbook, laid out just like your own */
const UserProfilePage = () => {
  const { userProfile, isError } = useProfile();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const { data: achievements } = useGetUserAchievements(
    userProfile?.user.id ?? '',
  );

  if (isError) {
    return <MissingBook />;
  }

  if (!userProfile?.user) {
    return <LoadingScreen />;
  }

  const { user } = userProfile;

  return (
    <Layout
      back
      header={
        <FriendHeader
          userProfile={userProfile}
          stats={
            <ProfileStats
              userId={user.id}
              friends={userProfile.friends.length}
              drawings={userProfile.prompts.length}
              stickers={achievements?.filter((a) => a.achievedAt).length}
              onFriendsClick={() => setFriendsOpen(true)}
            />
          }
        >
          <FriendshipButton profile={userProfile} />
          <ShareButton
            urlPath={`/draw/profile/${user.id}`}
            text={`Check out ${user.username}'s sketchbook!`}
            className="ml-auto"
          >
            share
          </ShareButton>
        </FriendHeader>
      }
    >
      <FriendEventLink user={user} />
      <Sketchbook profile={userProfile} />
      {achievements && (
        <StickerBook
          userId={user.id}
          achievements={achievements}
          emptyText="no stickers yet. one doodle and they're on the board."
        />
      )}

      <Sheet
        title={`${user.username}'s friends`}
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
      >
        <FriendList user={user} friends={userProfile.friends} />
      </Sheet>
    </Layout>
  );
};

export default UserProfilePage;
