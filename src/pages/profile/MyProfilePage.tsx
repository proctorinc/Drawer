import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useMyProfilePage } from './context/MyProfileContext';
import AccountFooter from './components/AccountFooter';
import EditProfile from './components/EditProfile';
import Sheet from './components/Sheet';
import Sketchbook from './components/Sketchbook';
import UserHeader from './components/UserHeader';
import FriendsPanel from './components/friends/FriendsPanel';
import IncomingInvites from './components/friends/IncomingInvites';
import { useFriendInvites } from './components/friends/useFriendInvites';
import { FriendsIcon, PencilIcon, TrophyIcon } from '@/components/icons';
import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import Chip from '@/components/Chip';
import Button from '@/components/Button';

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

/** A peek at the trophy shelf, which lives on its own tab */
const TrophyTeaser = () => {
  const { achievementsData } = useMyProfilePage();
  const won =
    achievementsData?.achievements.filter((a) => a.achievedAt).length ?? 0;

  return (
    <Link to="/draw/trophies" className="self-start active:scale-95">
      <Chip className="bg-me">
        <TrophyIcon size={16} />
        {won > 0
          ? `${won} ${won === 1 ? 'trophy' : 'trophies'}`
          : 'win trophies'}{' '}
        →
      </Chip>
    </Link>
  );
};

const MyProfilePage = () => {
  const { profile } = useMyProfilePage();
  const { incoming } = useFriendInvites();
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });

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

  const friendCount = profile.friends.length;
  // Sits beside the hall of fame; a blank book has no hall, so it stays under the cover
  const hasSketchbook = profile.prompts.length > 0;
  const friendsButton = (
    <Button size="sm" disableLoad onClick={() => setSheet('friends')}>
      <FriendsIcon size={20} />
      {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
      {incoming.length > 0 && (
        <span
          aria-label={`${incoming.length} new requests`}
          className="flex items-center justify-center min-w-6 h-6 px-1.5 -my-1 bg-coral text-ink border-2 border-paper rounded-full text-base animate-nudge"
        >
          {incoming.length}
        </span>
      )}
    </Button>
  );

  return (
    <Layout
      header={
        <UserHeader
          userProfile={profile}
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
          extra={<TrophyTeaser />}
        >
          {!hasSketchbook && friendsButton}
        </UserHeader>
      }
    >
      <IncomingInvites />
      <Sketchbook profile={profile} aside={friendsButton} />
      <AccountFooter />

      <Sheet
        title={sheet ? SHEET_TITLES[sheet] : ''}
        open={sheet !== null}
        onClose={closeSheet}
      >
        {sheet === 'friends' && <FriendsPanel profile={profile} />}
        {sheet === 'edit' && <EditProfile />}
      </Sheet>
    </Layout>
  );
};

export default MyProfilePage;
