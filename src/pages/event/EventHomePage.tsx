import { Link, Navigate } from '@tanstack/react-router';
import { useGetAchievements } from '@/api/Api';
import { useActiveEvent } from '@/api/events';
import { TrophyIcon } from '@/components/icons';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import ChristmasTrophies from '@/events/christmas/ChristmasTrophies';

/** The live event's home: your progress in it, with a way to your usual trophies */
const EventHomePage = () => {
  const { data: event, isLoading } = useActiveEvent();
  const { data: achievements } = useGetAchievements();

  if (isLoading) return <LoadingScreen />;
  // The event ended, or none is on: the tab falls back to trophies
  if (event?.theme !== 'christmas') return <Navigate to="/draw/trophies" />;

  const stickers =
    achievements?.achievements.filter((a) => a.eventSlug === event.slug) ?? [];

  return (
    <Layout>
      <ChristmasTrophies event={event} stickers={stickers} />
      <Link
        to="/draw/trophies"
        className="press flex items-center justify-center gap-2 w-full pt-4 border-t-2 border-dashed border-line font-accent font-bold text-xl text-pencil hover:text-ink transition-colors"
      >
        <TrophyIcon size={20} />
        your year-round trophies →
      </Link>
    </Layout>
  );
};

export default EventHomePage;
