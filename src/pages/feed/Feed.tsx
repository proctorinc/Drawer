import { faFrown, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import PromptCanvas from './components/PromptCanvas';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Banner from '@/components/Banner';
import Disclaimer, { DisclaimerItem } from '@/components/Disclaimer';

const Feed = () => {
  const { dailyPrompt } = useDailyPrompt();

  const hasPromptBeenCompleted = dailyPrompt && dailyPrompt.isCompleted;
  const promptNotCompleted = dailyPrompt && !dailyPrompt.isCompleted;
  const isNoPrompt = !dailyPrompt;

  return (
    <Layout
      header={
        (hasPromptBeenCompleted || isNoPrompt) && (
          <div className="flex flex-col items-center gap-1 rounded-full text-2xl w-full max-w-sm mb-6">
            <CountDownTimer className="font-cursive text-5xl" />
            <span className="text-sm font-extrabold tracking-wide text-secondary">
              Next Doodle
            </span>
          </div>
        )
      }
    >
      {promptNotCompleted && !isNoPrompt && (
        <>
          <Banner icon={faInfoCircle}>
            Use today's colors to draw the prompt
          </Banner>
          <div className="flex flex-col items-center w-full -my-4">
            <h3 className="text-xl text-balance font-bold text-primary">
              Draw {dailyPrompt.prompt.toLowerCase()}
            </h3>
          </div>
        </>
      )}
      {!dailyPrompt && (
        <Banner icon={faFrown}>
          <p className="text-sm">Sorry, there's no prompt for today</p>
        </Banner>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && (
        <Disclaimer title="Updates! User profiles, favorite doodles">
          <DisclaimerItem>
            You can now view other user's profiles by clicking on their icons.
          </DisclaimerItem>
          <DisclaimerItem>
            You can also choose 3 favorite doodles to display on your own
            profile. Click the star icon to favorite one of your drawings.
          </DisclaimerItem>
        </Disclaimer>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && <SubmissionFeedList />}
      <PromptCanvas />
      {!hasPromptBeenCompleted && !isNoPrompt && (
        <Disclaimer title="Rules, you say?">
          <DisclaimerItem>
            Just kidding - no rules, but here's a tip
          </DisclaimerItem>
          <DisclaimerItem>
            Don't write text, just draw and let people guess!
          </DisclaimerItem>
        </Disclaimer>
      )}
    </Layout>
  );
};

export default Feed;
