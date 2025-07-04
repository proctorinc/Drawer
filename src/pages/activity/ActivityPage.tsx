import Layout from '@/components/Layout';
import { useProfile } from '@/pages/profile/UserProfileContext';
import ActivityFeed from './components/ActivityFeed';
import LoadingScreen from '@/components/LoadingScreen';
import { useActivityFeed } from '@/api/Api';

const ActivityPage = () => {
  const { userProfile } = useProfile();
  const { isLoading } = useActivityFeed();

  if (!userProfile) {
    return <></>;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <div className="pl-1 font-bold">
        <h2 className="text-2xl text-primary">Recent Activity</h2>
      </div>
      <ActivityFeed />
    </Layout>
  );
};

export default ActivityPage;
