import Layout from '@/components/Layout';
import { useProfile } from '@/pages/profile/UserProfileContext';
import ActivityFeed from './components/ActivityFeed';

const ActivityPage = () => {
  const { userProfile } = useProfile();

  if (!userProfile) {
    return <></>;
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
