import { useNavigate } from '@tanstack/react-router';
import { useProfile } from './profile/UserProfileContext';
import { CountDownTimer } from './daily/CountdownTimer';
import { SubmissionFeedList } from './profile/components/SubmissionFeedList';
import { useDailyPrompt } from './daily/DailyPromptContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Toolbar } from './drawing/Toolbar';
import { useDrawing } from './drawing/DrawingContext';
import Canvas from './drawing/Canvas';
import { UserProfileIcon } from './profile/components/UserProfileIcon';
import { useState } from 'react';
import { Config } from './config/Config';

function App() {
  const navigate = useNavigate();
  const { userProfile } = useProfile();
  const { dailyPrompt, submitPrompt, isFetching } = useDailyPrompt();
  const { canvasRef, canUndo, clearCanvas } = useDrawing();
  const [error, setError] = useState("");
  const formattedDate = dailyPrompt ? new Date(dailyPrompt.day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) : '';

  async function handleSubmitCanvas() {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
        const canvasData = JSON.stringify({
          width: Config.CANVAS_WIDTH,
          height: Config.CANVAS_HEIGHT,
          data: Array.from(imageData.data)
        });
        submitPrompt(canvasData)
          .then(() => navigate({ to: "/app/user-profile" }))
          .then(() => clearCanvas())
          .catch((error) => {
            setError(error.message);
          });
      } else {
        console.error("Failed to get canvas context");
      }
    } else {
      console.error("Failed to get canvas reference");
    }
  }

  if (dailyPrompt && userProfile && dailyPrompt.isCompleted) {
    return (
        <div className="flex flex-col items-center p-2 gap-4 bg-gray-100 pb-10 min-h-screen">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <CountDownTimer />
                  <p className="text-sm text-gray-500">Next prompt</p>
                </div>
                <UserProfileIcon user={userProfile.user} onClick={() => navigate({ to: '/app/user-profile' })} />
            </div>
            <SubmissionFeedList />
        </div>
    );
  }

  return (
      <>
        {!dailyPrompt || !userProfile && (
            <div className="absolute flex flex-col items-center justify-center h-screen w-full dark:bg-gray-100">
            <div className="w-12 h-12 animate-spin rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 font-semibold flex items-center justify-center"></div>
          </div>
        )}
        <div className="flex flex-col items-center p-2 gap-4 bg-gray-100 pb-10 min-h-screen">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md">
                {!isFetching && !dailyPrompt ? (
                  <></>
                ) : (
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    <h1>Draw {dailyPrompt?.prompt}</h1>
                    <p className="text-sm text-gray-500">
                      {formattedDate}
                    </p>
                  </div>
                )}
                <UserProfileIcon user={userProfile?.user} onClick={() => navigate({ to: '/app/user-profile' })} />
            </div>
            <Canvas ref={canvasRef} />
            <div className="flex gap-2 justify-center items-center border border-gray-200 rounded-2xl bg-gray-200 px-4 py-2 w-full max-w-md text-gray-500">
              <FontAwesomeIcon icon={faInfoCircle} />
              {!isFetching && !dailyPrompt ? (
                <p className="text-sm">
                  There's no prompt for today
                </p>
              ) : (
                <p className="text-sm">
                  Use today's three colors to draw the prompt
                </p>
              )}
            </div>
            <Toolbar />
            {error && <p className="text-center text-red-500">{error}</p>}
            <button
              className="flex text-lg gap-2 cursor-pointer disabled:cursor-default disabled:scale-100 hover:scale-110 transition-all duration-300 items-center bg-gradient-to-tr from-blue-600 to-purple-600 font-bold px-6 py-3 rounded-2xl shadow-md disabled:opacity-30"
              onClick={handleSubmitCanvas}
              disabled={!canUndo}
            >
              Submit
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
      </>
    )
}

export default App
