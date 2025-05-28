import { useNavigate } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFrown } from '@fortawesome/free-solid-svg-icons';
import { useProfile } from '../profile/UserProfileContext';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { UserProfileIcon } from '../profile/components/UserProfileIcon';
import PromptCanvas from './components/PromptCanvas';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Header from '@/components/Header';

const Feed = () => {
  const navigate = useNavigate();
  const { userProfile } = useProfile();
  const { isFetching, dailyPrompt } = useDailyPrompt();
  const formattedDate = dailyPrompt
    ? new Date(dailyPrompt.day).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const isLoading = !userProfile || isFetching;
  const hasPromptBeenCompleted = dailyPrompt && dailyPrompt.isCompleted;
  const isNoPrompt = !isFetching && !dailyPrompt;

  return (
    <Layout>
      <Header
        title={
          hasPromptBeenCompleted || isNoPrompt ? (
            <CountDownTimer />
          ) : (
            `Draw ${dailyPrompt?.prompt.toLowerCase()}`
          )
        }
        subtitle={
          hasPromptBeenCompleted || isNoPrompt ? 'Next prompt' : formattedDate
        }
        isLoading={isLoading}
      >
        <UserProfileIcon
          user={userProfile?.user}
          onClick={() => navigate({ to: '/app/user-profile' })}
        />
      </Header>
      {!isFetching && !dailyPrompt && (
        <div className="flex gap-2 justify-center items-center border border-gray-200 rounded-2xl bg-gray-200 px-4 py-2 w-full max-w-md text-gray-500">
          <FontAwesomeIcon icon={faFrown} />
          <p className="text-sm">
            Sorry, looks like there's no prompt for today
          </p>
        </div>
      )}
      {(isLoading || hasPromptBeenCompleted || isNoPrompt) && (
        <SubmissionFeedList isLoading={isLoading} />
      )}
      <PromptCanvas />
    </Layout>
  );
};

export default Feed;
