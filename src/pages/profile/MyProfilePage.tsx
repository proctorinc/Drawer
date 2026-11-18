import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { faGear, faPen } from '@fortawesome/free-solid-svg-icons';
import { useMyProfilePage } from './context/MyProfileContext';
import AccountDetails from './components/AccountDetails';
import EditProfile from './components/EditProfile';
import Sheet from './components/Sheet';
import Sketchbook from './components/Sketchbook';
import UserHeader from './components/UserHeader';
import FriendsPanel from './components/friends/FriendsPanel';
import IncomingInvites from './components/friends/IncomingInvites';
import { useFriendInvites } from './components/friends/useFriendInvites';
import { FriendsIcon, TrophyIcon } from '@/components/icons';
import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import Chip from '@/components/Chip';
import Button from '@/components/Button';

type SheetId = 'friends' | 'edit' | 'settings';

const SHEET_TITLES: Record<SheetId, string> = {
  friends: 'friends',
  edit: 'edit my cover',
  settings: 'settings',
};

/** A peek at the trophy shelf, which lives on its own tab */
const TrophyTeaser = () => {
  const { achievementsData } = useMyProfilePage();
  const won =
    achievementsData?.achievements.filter((a) => a.achievedAt).length ?? 0;

  return (
    <Link to="/draw/trophies" className="self-start active:scale-95">
      <Chip className="bg-butter">
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

  if (!profile) {
    return <LoadingScreen />;
  }

  return (
    <Layout
      header={
        <UserHeader
          userProfile={profile}
          onAvatarClick={() => setSheet('edit')}
          extra={<TrophyTeaser />}
        >
          <Button size="sm" disableLoad onClick={() => setSheet('friends')}>
            <FriendsIcon size={20} />
            friends
            {incoming.length > 0 && (
              <span
                aria-label={`${incoming.length} new requests`}
                className="flex items-center justify-center min-w-6 h-6 px-1.5 -my-1 bg-coral text-ink border-2 border-paper rounded-full text-base animate-nudge"
              >
                {incoming.length}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            variant="base"
            icon={faPen}
            disableLoad
            onClick={() => setSheet('edit')}
          >
            edit
          </Button>
          <Button
            size="sm"
            variant="base"
            icon={faGear}
            aria-label="Settings"
            disableLoad
            className="ml-auto"
            onClick={() => setSheet('settings')}
          />
        </UserHeader>
      }
    >
      <IncomingInvites />
      <Sketchbook profile={profile} />

      <Sheet
        title={sheet ? SHEET_TITLES[sheet] : ''}
        open={sheet !== null}
        onClose={() => setSheet(null)}
      >
        {sheet === 'friends' && <FriendsPanel profile={profile} />}
        {sheet === 'edit' && <EditProfile />}
        {sheet === 'settings' && <AccountDetails />}
      </Sheet>
    </Layout>
  );
};

export default MyProfilePage;
