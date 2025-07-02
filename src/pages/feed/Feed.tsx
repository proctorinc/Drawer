import { faFrown, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import PromptCanvas from './components/PromptCanvas';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Banner from '@/components/Banner';

const Feed = () => {
  const { dailyPrompt } = useDailyPrompt();
  const formattedDate = dailyPrompt
    ? new Date(dailyPrompt.day).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const hasPromptBeenCompleted = dailyPrompt && dailyPrompt.isCompleted;
  const promptNotCompleted = dailyPrompt && !dailyPrompt.isCompleted;
  const isNoPrompt = !dailyPrompt;

  return (
    <Layout>
      {promptNotCompleted && !isNoPrompt && (
        <>
          <Banner icon={faInfoCircle}>
            Use today's colors to draw the prompt
          </Banner>
          <div className="flex flex-col items-center w-full -mb-4">
            <h3 className="text-xl font-bold text-primary">
              Draw {dailyPrompt.prompt.toLowerCase()}
            </h3>
            <p className="font-bold text-secondary">{formattedDate}</p>
          </div>
        </>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && (
        <Banner>
          Next Prompt in <CountDownTimer />
        </Banner>
      )}
      {!dailyPrompt && (
        <Banner icon={faFrown}>
          <p className="text-sm">Sorry, there's no prompt for today</p>
        </Banner>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && <SubmissionFeedList />}
      <PromptCanvas />
    </Layout>
  );
};

export default Feed;
