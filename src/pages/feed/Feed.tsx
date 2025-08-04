import { useState } from 'react';
import { faFrown, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { CountDownTimer } from '../../daily/CountdownTimer';
import { useDailyPrompt } from '../../daily/DailyPromptContext';
import { SubmissionFeedList } from './components/SubmissionFeedList';
import Layout from '@/components/Layout';
import Banner from '@/components/Banner';
import Disclaimer, { DisclaimerItem } from '@/components/Disclaimer';
import { useDrawing } from '@/drawing/DrawingContext';
import DrawingCanvas from './components/DrawingCanvas';

const Feed = () => {
  const { dailyPrompt, submitPrompt } = useDailyPrompt();
  const { clearCanvas } = useDrawing();
  const [error, setError] = useState<string | null>(null);

  const hasPromptBeenCompleted = dailyPrompt && dailyPrompt.isCompleted;
  const promptNotCompleted = dailyPrompt && !dailyPrompt.isCompleted;
  const isNoPrompt = !dailyPrompt;

  function handleSubmit(png: Blob) {
    submitPrompt(png, {
      onSuccess: () => {
        setError(null);
        clearCanvas();
      },
      onError: () => {
        setError('Failed to submit drawing');
      },
    });
  }

  return (
    <Layout
      hideHeader={!hasPromptBeenCompleted && !!dailyPrompt}
      header={
        (hasPromptBeenCompleted || isNoPrompt) && (
          <div className="flex flex-col items-center gap-1 rounded-full text-2xl w-full max-w-sm mb-6">
            <CountDownTimer className="font-cursive text-5xl" />
            <span className="text-sm font-extrabold tracking-wide text-secondary/80">
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
      {/* {(hasPromptBeenCompleted || isNoPrompt) && (
        <Disclaimer title="Updates! User profiles, favorite doodles">
          <DisclaimerItem>
            You can now view other user's profiles by clicking on their icons.
          </DisclaimerItem>
          <DisclaimerItem>
            You can also choose 3 favorite doodles to display on your own
            profile. Click the star icon to favorite one of your drawings.
          </DisclaimerItem>
        </Disclaimer>
      )} */}
      {(hasPromptBeenCompleted || isNoPrompt) && (
        <Disclaimer title="Updates?? Achievements, custom avatars">
          <DisclaimerItem>
            View your achievements under Profile {'>'} Awards
          </DisclaimerItem>
          <DisclaimerItem>
            You can unlock a custom avatar by getting a 14 day doodle streak.
            Once unlocked, go to your profile settings to create it.
          </DisclaimerItem>
          <DisclaimerItem>
            View/manage friend requests under Activity {'>'} Invites
          </DisclaimerItem>
        </Disclaimer>
      )}
      {(hasPromptBeenCompleted || isNoPrompt) && <SubmissionFeedList />}
      <DrawingCanvas
        backgroundColor={
          dailyPrompt?.colors.length === 4 ? dailyPrompt.colors[3] : undefined
        }
        onSubmit={(png) => handleSubmit(png)}
        colors={dailyPrompt?.colors ? dailyPrompt.colors.slice(0, 3) : []}
        hidden={hasPromptBeenCompleted || isNoPrompt}
      />
      {error && (
        <p className="text-center text-sm font-bold text-red-700">{error}</p>
      )}
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
