import { useParams, useSearch } from '@tanstack/react-router';
import Layout from '@/components/Layout';
import EventLeaderboard from '@/events/christmas/EventLeaderboard';
import EventRecap from '@/events/christmas/EventRecap';

/** One person's event: stats, their tree, every doodle (and, for you, the standings) */
const EventRecapPage = () => {
  const { slug } = useParams({ from: '/draw/event/$slug' });
  // Opened from someone's profile: their recap instead of yours
  const { user } = useSearch({ from: '/draw/event/$slug' });

  return (
    <Layout back>
      <EventRecap slug={slug} userId={user} />
      {!user && (
        <>
          <h2 className="self-start font-accent font-bold text-[28px] leading-none">
            standings
          </h2>
          <EventLeaderboard slug={slug} />
        </>
      )}
    </Layout>
  );
};

export default EventRecapPage;
