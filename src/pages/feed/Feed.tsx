import { useNavigate } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFrown, faUser } from '@fortawesome/free-solid-svg-icons';
import { useProfile } from '../profile/UserProfileContext';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import PromptCanvas from './components/PromptCanvas';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Header from '@/components/Header';
import { Config } from '@/config/Config';

const Feed = () => {
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
  const promptNotCompleted = dailyPrompt && !dailyPrompt.isCompleted;
  const isNoPrompt = !isFetching && !dailyPrompt;

  return (
    <Layout>
      <Header
        title={
          !isLoading && promptNotCompleted ? (
            `Draw ${dailyPrompt?.prompt.toLowerCase()}`
          ) : (
            <span className="font-cursive tracking-widest">
              {Config.APP_NAME}
            </span>
          )
        }
        subtitle={!isLoading && promptNotCompleted ? formattedDate : 'Feed'}
      >
        <UserProfileButton />
      </Header>
      {(hasPromptBeenCompleted || isNoPrompt) && (
        <div className="flex gap-2 justify-center items-center rounded-2xl border-2 border-border bg-border px-4 py-2 w-full max-w-md font-bold text-primary">
          Next Prompt in <CountDownTimer />
        </div>
      )}
      {!isFetching && !dailyPrompt && (
        <div className="flex gap-2 justify-center items-center rounded-2xl border-2 border-border bg-border px-4 py-2 w-full max-w-md font-bold text-primary">
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

const UserProfileButton = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate({ to: '/app/user-profile' })}
      className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faUser} />
    </div>
  );
};

export default Feed;
