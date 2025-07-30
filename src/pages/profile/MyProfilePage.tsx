import AccountDetails from './components/AccountDetails';
import Layout from '@/components/Layout';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import FavoriteSubmissions from './components/FavoriteSubmissions';
import LoadingScreen from '@/components/LoadingScreen';
import UserHeader from './components/UserHeader';
import Button from '@/components/Button';
import {
  faAward,
  faGear,
  faUserCircle,
} from '@fortawesome/free-solid-svg-icons';
import AchievementCard from './components/AchievementCard';
import { cn } from '@/utils';
import { Card, CardContent } from '@/components/Card';
import useLocalStorage from '@/hooks/useLocalStorage';

type TabState = 'profile' | 'settings' | 'achievements';

const MyProfilePage = () => {
  const { profile, achievementsData } = useMyProfilePage();
  const [tab, setTab] = useLocalStorage<TabState>(
    'PROFILE_PAGE_TAB',
    'profile',
  );

  const completedAchievements = achievementsData?.achievements
    ? achievementsData.achievements
        .filter((achievement) => achievement.achievedAt)
        .sort((a, b) => {
          if (!a.achievedAt && !!b.achievedAt) {
            return -1;
          } else if (!!a.achievedAt && !b.achievedAt) {
            return 1;
          } else {
            return 0;
          }
        })
    : [];
  const inProgressAchievements = achievementsData?.achievements
    ? achievementsData.achievements
        .filter((achievement) => !achievement.achievedAt)
        .sort((a, b) => {
          if (!a.achievedAt && !!b.achievedAt) {
            return -1;
          } else if (!!a.achievedAt && !b.achievedAt) {
            return 1;
          } else {
            return 0;
          }
        })
    : [];

  if (!profile?.user) {
    return <LoadingScreen />;
  }

  return (
    <Layout
      back
      header={
        <UserHeader
          className={cn(
            'transition-all duration-300',
            tab === 'profile'
              ? 'opacity-100'
              : 'h-0 -translate-y-[100px] opacity-0',
          )}
          userProfile={profile}
        />
      }
    >
      <div className="flex justify-center w-full">
        <div className="w-full">
          <Button
            icon={faUserCircle}
            size="sm"
            variant={tab === 'profile' ? 'primary' : 'base'}
            className=" disabled:text-primary w-full h-10"
            onClick={() => setTab('profile')}
            disableLoad
          >
            Profile
          </Button>
        </div>
        <div className="w-full">
          <Button
            icon={faAward}
            size="sm"
            variant={tab === 'achievements' ? 'primary' : 'base'}
            className=" disabled:text-primary w-full h-10"
            onClick={() => setTab('achievements')}
            disableLoad
          >
            Awards
          </Button>
        </div>
        <div className="relative w-full">
          <Button
            icon={faGear}
            size="sm"
            className="disabled:text-primary w-full h-10"
            variant={tab === 'settings' ? 'primary' : 'base'}
            onClick={() => setTab('settings')}
            disableLoad
          >
            Settings
          </Button>
          {/* <div className="absolute flex items-center justify-center top-1/2 -translate-y-1/2 left-4 w-4 h-4 bg-base text-red-500 rounded-full">
            <FontAwesomeIcon icon={faExclamationCircle} />
          </div> */}
        </div>
      </div>
      {tab === 'profile' && (
        <>
          <FavoriteSubmissions profile={profile} />
          <SubmissionCalendar profile={profile} />
          <FriendList user={profile.user} friends={profile.friends} />
        </>
      )}
      {tab === 'achievements' && (
        <>
          <div className="pl-1 font-bold w-full">
            <h2 className="text-xl text-primary">Working on</h2>
          </div>
          <div className="flex flex-col gap-4 w-full">
            {inProgressAchievements.length === 0 && (
              <Card>
                <CardContent className="text-center text-secondary font-bold">
                  More goals coming soon!
                </CardContent>
              </Card>
            )}
            {inProgressAchievements.map((achievement) => (
              <AchievementCard achievement={achievement} />
            ))}
          </div>
          <div className="pl-1 font-bold w-full">
            <h2 className="text-xl text-primary">Achieved</h2>
          </div>
          <div className="flex flex-col gap-4 w-full pb-40">
            {completedAchievements.length === 0 && (
              <Card>
                <CardContent className="text-center text-secondary font-bold">
                  You haven't completed any yet
                </CardContent>
              </Card>
            )}
            {completedAchievements.map((achievement) => (
              <AchievementCard achievement={achievement} />
            ))}
          </div>
        </>
      )}
      {tab === 'settings' && <AccountDetails />}
    </Layout>
  );
};

export default MyProfilePage;
