import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import DayCarousel from './components/DayCarousel';
import type { InfiniteData } from '@tanstack/react-query';
import type { FeedPage, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useGetMyProfile, usePromptSubmission } from '@/api/Api';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';

const PromptSubmissionPage = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams({
    from: '/_app/draw/submission/$submissionId',
  });
  const { book } = useSearch({ from: '/_app/draw/submission/$submissionId' });
  const queryClient = useQueryClient();
  const { data: profile } = useGetMyProfile();
  // Whatever's already loaded, without fetching more just to look
  const loaded: Array<UserPromptSubmission> = [
    ...(queryClient
      .getQueryData<InfiniteData<FeedPage>>(queryKeys.feed)
      ?.pages.flatMap((page) => page.submissions) ?? []),
    ...(profile?.prompts ?? []),
  ];
  const {
    data: submission,
    isLoading,
    error,
  } = usePromptSubmission(
    submissionId,
    // Swiping to a friend's doodle shows it straight away
    loaded.find((doodle) => doodle.id === submissionId),
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !submission) {
    return (
      <Layout back>
        <h1 className="p-8 text-center text-primary font-bold text-xl">
          I'm sorry, it looks like this doodle doesn't exist
        </h1>
        <Button onClick={() => navigate({ to: '/draw' })}>Go back</Button>
      </Layout>
    );
  }

  // Remount per day (or per book), so the pages start from whatever you opened
  return (
    <DayCarousel
      key={book ?? submission.day}
      submission={submission}
      book={book}
    />
  );
};

export default PromptSubmissionPage;
