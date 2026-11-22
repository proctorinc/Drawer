import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useMyProfilePage } from './context/MyProfileContext';
import AccountFooter from './components/AccountFooter';
import EditProfile from './components/EditProfile';
import FlairShelf from './components/FlairShelf';
import Sheet from './components/Sheet';
import ProfileStats from './components/ProfileStats';
import Sketchbook from './components/Sketchbook';
import StickerBook from './components/StickerBook';
import UserHeader from './components/UserHeader';
import FriendsPanel from './components/friends/FriendsPanel';
import IncomingInvites from './components/friends/IncomingInvites';
import { useFriendInvites } from './components/friends/useFriendInvites';
import { PencilIcon } from '@/components/icons';
import LoadingScreen from '@/components/LoadingScreen';
import { useGetTrophies } from '@/api/trophies';
import { levelTitle } from '@/levels/ranks';
import Layout from '@/components/Layout';

type SheetId = 'friends' | 'edit';

const SHEET_TITLES: Record<SheetId, string> = {
  friends: 'friends',
  edit: 'edit my cover',
};

/** Links can open a sheet straight away: #friends, or #decorations in the edit sheet */
const SHEET_FOR_HASH: Record<string, SheetId | undefined> = {
  friends: 'friends',
  decorations: 'edit',
};

const MyProfilePage = () => {
  const { profile, achievementsData } = useMyProfilePage();
  const { incoming } = useFriendInvites();
  const { data: trophies } = useGetTrophies();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });
  const tryOn = useSearch({ from: '/_app/draw/profile/me' }).try;

  useEffect(() => {
    const linked = SHEET_FOR_HASH[hash];
    if (linked) setSheet(linked);
  }, [hash]);

  // Runs after the sheet has opened, so the linked section exists to scroll to
  useEffect(() => {
    if (sheet && SHEET_FOR_HASH[hash] === sheet) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sheet, hash]);

  function closeSheet() {
    setSheet(null);
    // Drop the hash so the same link opens the sheet again next time
    if (hash) navigate({ to: '/draw/profile/me', replace: true });
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  const achievements = achievementsData?.achievements;
  const level = trophies?.level.level;

  return (
    <Layout
      header={
        <UserHeader
          userProfile={profile}
          ranked
          level={level}
          title={level ? levelTitle(level).toLowerCase() : undefined}
          onAvatarClick={() => setSheet('edit')}
          avatarBadge={
            <button
              aria-label="Edit my cover"
              onClick={() => setSheet('edit')}
              className="press grid place-items-center size-8 bg-me border-2 border-ink rounded-full shadow-pencil-sm cursor-pointer"
            >
              <PencilIcon size={16} />
            </button>
          }
          stats={
            <ProfileStats
              userId="me"
              friends={profile.friends.length}
              drawings={profile.prompts.length}
              stickers={achievements?.filter((a) => a.achievedAt).length}
              onFriendsClick={() => setSheet('friends')}
              friendRequests={incoming.length}
            />
          }
        />
      }
    >
      <IncomingInvites />
      <Sketchbook profile={profile} />
      {achievements && (
        <StickerBook
          userId="me"
          achievements={achievements}
          emptyText="No stickers yet. Your first one is a single drawing away."
        />
      )}
      <FlairShelf />
      <AccountFooter />

      <Sheet
        title={sheet ? SHEET_TITLES[sheet] : ''}
        open={sheet !== null}
        onClose={closeSheet}
      >
        {sheet === 'friends' && <FriendsPanel profile={profile} />}
        {sheet === 'edit' && <EditProfile tryOn={tryOn} />}
      </Sheet>
    </Layout>
  );
};

export default MyProfilePage;
