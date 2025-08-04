import Layout from '@/components/Layout';
import ActivityFeed from './components/ActivityFeed';
import LoadingScreen from '@/components/LoadingScreen';
import {
  useActivityFeed,
  useGetInvitations,
  useAcceptInvitation,
  useDenyInvitation,
} from '@/api/Api';
import Button from '@/components/Button';
import { useState } from 'react';
import {
  faCaretDown,
  faCaretUp,
  faCheckCircle,
  faClock,
  faComment,
  faEnvelope,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardContent } from '@/components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@/utils';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import useLocalStorage from '@/hooks/useLocalStorage';

type TabState = 'activity' | 'invitations';

const ActivityPage = () => {
  const { data, isLoading } = useActivityFeed();
  const [tab, setTab] = useState<TabState>('activity');
  const [friendsExpanded, setFriendsExpanded] = useLocalStorage<boolean>(
    'ACTIVITY_PAGE_EXPANDED',
    false,
  );
  // const [username, setUsername] = useState('');
  const [inviteError, setInviteError] = useState('');
  // const [inviteSuccess, setInviteSuccess] = useState('');
  // const [lookupUsername, setLookupUsername] = useState('');
  // const [pendingUsername, setPendingUsername] = useState('');
  // const inviteFriendMutation = useInviteFriend();
  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    refetch: refetchInvitations,
  } = useGetInvitations();
  const acceptInvitation = useAcceptInvitation();
  const denyInvitation = useDenyInvitation();
  // const {
  //   data: foundUser,
  //   isLoading: userLookupLoading,
  //   error: userLookupError,
  // } = useGetUserByUsername(lookupUsername);

  // async function handleInviteFriend(event: FormEvent<HTMLFormElement>) {
  //   event.preventDefault();
  //   setInviteError('');
  //   setInviteSuccess('');
  //   setPendingUsername(username);
  //   setLookupUsername(username);
  // }

  function handleAccept(userId: string) {
    acceptInvitation.mutate(userId, {
      onSuccess: () => refetchInvitations(),
      onError: (err: any) =>
        setInviteError(err.message || 'Failed to accept invitation'),
    });
  }

  function handleDeny(userId: string) {
    denyInvitation.mutate(userId, {
      onSuccess: () => refetchInvitations(),
      onError: (err: any) =>
        setInviteError(err.message || 'Failed to deny invitation'),
    });
  }

  if (isLoading || invitationsLoading) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <div className="flex justify-center w-full">
        <div className="w-1/2">
          <Button
            icon={faComment}
            size="sm"
            variant={tab === 'invitations' ? 'base' : 'primary'}
            className=" disabled:text-primary w-full h-10"
            onClick={() => setTab('activity')}
            disableLoad
          >
            Activity
          </Button>
        </div>
        <div className="relative w-1/2">
          <Button
            icon={faEnvelope}
            size="sm"
            className="disabled:text-primary w-full h-10"
            variant={tab === 'activity' ? 'base' : 'primary'}
            onClick={() => setTab('invitations')}
            disableLoad
          >
            Invites
          </Button>
          {invitationsData?.invitee && invitationsData.invitee.length > 0 && (
            <div className="absolute flex items-center justify-center top-1/2 -translate-y-1/2 left-4 w-4 h-4 bg-base text-red-500 rounded-full">
              <FontAwesomeIcon icon={faExclamationCircle} />
            </div>
          )}
        </div>
      </div>
      {tab === 'activity' && (
        <>
          <div
            className="flex flex-col gap-4 w-full"
            // onMouseDown={() => setFriendsExpanded(true)}
            // onMouseUp={() => setFriendsExpanded(false)}
            // onMouseLeave={() => setFriendsExpanded(false)}
            // onTouchStart={() => setFriendsExpanded(true)}
            // onTouchEnd={() => setFriendsExpanded(false)}
            // style={{ cursor: 'pointer' }}
          >
            <div className="flex w-full justify-between items-center">
              <div className="flex w-full font-bold">
                <h2 className="text-xl text-primary">Today's drawing</h2>
              </div>
              {data?.friends && data.friends.length > 1 && (
                <Button
                  variant="base"
                  size="sm"
                  icon={friendsExpanded ? faCaretUp : faCaretDown}
                  onClick={() => setFriendsExpanded((prev) => !prev)}
                  disableLoad
                >
                  {friendsExpanded ? 'Collapse' : 'Expand'}
                </Button>
              )}
            </div>
            <div
              className={cn(
                'flex w-full justify-start gap-2 transition-all duration-300',
                friendsExpanded && 'flex-wrap',
              )}
            >
              {data?.friends
                .sort((a, b) => {
                  if (a.hasSubmittedToday && !b.hasSubmittedToday) {
                    return -1;
                  } else if (!a.hasSubmittedToday && b.hasSubmittedToday) {
                    return 1;
                  } else {
                    return 0;
                  }
                })
                .map((friend, idx) => (
                  <div
                    className="relative transition-transform duration-500"
                    style={
                      !friendsExpanded && idx !== 0
                        ? { transform: `translateX(-${idx * 20}px)` }
                        : { transform: 'translateX(0)' }
                    }
                    key={friend.user.id}
                  >
                    <UserProfileIcon user={friend.user} />
                    {friend.hasSubmittedToday && (
                      <div className="absolute flex items-center justify-center top-0 -left-1 w-4 h-4 bg-base text-emerald-400 rounded-full">
                        <FontAwesomeIcon icon={faCheckCircle} />
                      </div>
                    )}
                    {!friend.hasSubmittedToday && (
                      <div className="absolute flex items-center justify-center top-0 -left-1 w-4 h-4 bg-secondary text-primary rounded-full">
                        <FontAwesomeIcon icon={faClock} />
                      </div>
                    )}
                  </div>
                ))}
              {data?.friends.length === 0 && (
                <Card>
                  <CardContent className="text-secondary font-bold text-center">
                    No Friends yet
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <div className="pl-1 font-bold w-full">
            <h2 className="text-xl text-primary">Recent Activity</h2>
          </div>
          <ActivityFeed />
        </>
      )}
      {tab === 'invitations' && (
        <>
          {inviteError && (
            <p className="text-center text-sm font-bold text-red-700 -mb-2">
              {inviteError}
            </p>
          )}
          {/* <Card>
            <CardContent>
              <CardHeader
                title="Invite Friends"
                subtitle="Search by username"
              />
              <form onSubmit={handleInviteFriend}>
                <div className="flex gap-2 items-center rounded-2xl">
                  <input
                    type="text"
                    placeholder="Username"
                    className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    required
                  />
                </div>
                {inviteSuccess && (
                  <p className="text-center text-sm font-bold text-emerald-700 mb-2">
                    {inviteSuccess}
                  </p>
                )}
                {userLookupError && (
                  <p className="text-center text-sm font-bold text-red-700 mb-2">
                    User not found
                  </p>
                )}
              </form>
            </CardContent>
          </Card> */}
          <div className="pl-1 font-bold w-full">
            <h2 className="text-xl text-primary">Pending invites</h2>
          </div>
          {invitationsData?.invitee.length === 0 &&
            invitationsData.invited.length === 0 && (
              <Card>
                <CardContent className="text-center text-secondary font-bold">
                  No invitations
                </CardContent>
              </Card>
            )}
          {invitationsData?.invitee.map((invitation) => (
            <Card key={invitation.inviter.id}>
              <CardContent>
                <div className="flex gap-3 items-center font-bold text-primary">
                  <UserProfileIcon size="sm" user={invitation.inviter} />
                  <div>
                    <h3 className="text-lg">{invitation.inviter.username}</h3>{' '}
                    <h3 className="text-sm text-secondary">
                      wants to be your friend
                    </h3>
                  </div>
                </div>
                <div className="flex gap-1 w-full justify-center">
                  <Button
                    size="sm"
                    variant="base"
                    onClick={() => handleDeny(invitation.inviter.id)}
                    disabled={denyInvitation.isPending}
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invitation.inviter.id)}
                    disabled={acceptInvitation.isPending}
                  >
                    Accept
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {invitationsData?.invited.map((invitation) => (
            <Card key={invitation.invitee.id}>
              <CardContent>
                <div className="flex gap-3 items-center font-bold text-primary">
                  <UserProfileIcon size="sm" user={invitation.invitee} />
                  <div>
                    <h3 className="text-lg">
                      You friended {invitation.invitee.username}
                    </h3>{' '}
                    <h3 className="text-sm text-secondary">
                      waiting for approval
                    </h3>
                  </div>
                </div>
                <div className="flex gap-1 w-full justify-center">
                  <Button
                    size="sm"
                    variant="base"
                    onClick={() => handleDeny(invitation.invitee.id)}
                    disabled={denyInvitation.isPending}
                  >
                    Cancel invite
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </Layout>
  );
};

export default ActivityPage;
