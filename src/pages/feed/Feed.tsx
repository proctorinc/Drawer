import { faFrown, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import PromptCanvas from './components/PromptCanvas';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Banner from '@/components/Banner';
import { useState } from 'react';
import Button from '@/components/Button';

const Feed = () => {
  const { dailyPrompt } = useDailyPrompt();
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

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
        <Banner className="flex flex-col gap-1 rounded-full text-2xl">
          <CountDownTimer />
          <span className="text-sm text-primary">Next Doodle</span>
        </Banner>
      )}
      {!dailyPrompt && (
        <Banner icon={faFrown}>
          <p className="text-sm">Sorry, there's no prompt for today</p>
        </Banner>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && (
        <Banner className="flex flex-col gap-2 bg-base border-2 border-border text-secondary">
          <span className="py-2">Updates! User profiles, favorite doodles</span>
          {isUpdateOpen && (
            <>
              <span>
                You can now view other user's profiles by clicking on their
                icons.
              </span>
              <span>
                You can also choose 3 favorite doodles to display on your own
                profile. Click the star icon to favorite one of your drawings.
              </span>
            </>
          )}
          <Button
            disableLoad
            onClick={() => setIsUpdateOpen((prev) => !prev)}
            size="sm"
          >
            {isUpdateOpen ? 'hide' : 'show more'}
          </Button>
        </Banner>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && <SubmissionFeedList />}
      <PromptCanvas />
    </Layout>
  );
};

export default Feed;
