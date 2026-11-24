import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import DayCarousel from './components/DayCarousel';
import { useGetMyProfile, usePromptSubmission } from '@/api/Api';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';

const PromptSubmissionPage = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams({
    from: '/_app/draw/submission/$submissionId',
  });
  const { book } = useSearch({ from: '/_app/draw/submission/$submissionId' });
  const { data: profile } = useGetMyProfile();
  const {
    data: submission,
    isLoading,
    error,
  } = usePromptSubmission(
    submissionId,
    // Swiping to a friend's doodle shows it straight away
    [...(profile?.feed ?? []), ...(profile?.prompts ?? [])].find(
      (doodle) => doodle.id === submissionId,
    ),
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
