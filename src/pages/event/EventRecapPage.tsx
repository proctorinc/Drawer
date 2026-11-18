import { useParams } from '@tanstack/react-router';
import Layout from '@/components/Layout';
import EventLeaderboard from '@/events/christmas/EventLeaderboard';
import EventRecap from '@/events/christmas/EventRecap';

/** A look back at one event: stats, the tree, every doodle and the standings */
const EventRecapPage = () => {
  const { slug } = useParams({ from: '/draw/event/$slug' });

  return (
    <Layout back>
      <EventRecap slug={slug} />
      <h2 className="self-start font-accent font-bold text-[28px] leading-none">
        final standings
      </h2>
      <EventLeaderboard slug={slug} />
    </Layout>
  );
};

export default EventRecapPage;
