import { useBookOwner } from './useBookOwner';
import SubmissionList from './components/SubmissionList';
import Banner from '@/components/Banner';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';

/** Every page of someone's book, newest first, a chapter per month */
const DrawingsPage = () => {
  const { isMe, profile, isLoading, isError } = useBookOwner();

  if (isLoading) return <LoadingScreen />;

  if (isError || !profile) {
    return (
      <Layout back>
        <Banner className="bg-paper border-dashed">
          this sketchbook wouldn't open. try again in a bit?
        </Banner>
      </Layout>
    );
  }

  const { prompts, user } = profile;

  return (
    <Layout
      back
      header={
        <div className="flex items-end justify-between gap-2 w-full">
          <h1 className="font-accent font-bold text-[34px] leading-none truncate">
            {isMe ? 'my drawings' : `${user.username}'s drawings`}
          </h1>
          <span className="font-accent font-bold text-xl leading-none">
            {prompts.length}
          </span>
        </div>
      }
    >
      {prompts.length > 0 ? (
        <SubmissionList prompts={prompts} />
      ) : (
        <Banner className="bg-paper border-dashed">
          {isMe
            ? 'nothing here yet. today’s prompt is waiting!'
            : `${user.username} hasn't doodled yet.`}
        </Banner>
      )}
    </Layout>
  );
};

export default DrawingsPage;
