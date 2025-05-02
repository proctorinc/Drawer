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

function App() {
  const navigate = useNavigate();
  const { userProfile } = useProfile();
  const { dailyPrompt, submitPrompt } = useDailyPrompt();
  const { downloadCanvas, canvasRef, canUndo, clearCanvas } = useDrawing();
  const [error, setError] = useState("");
  const formattedDate = dailyPrompt ? new Date(dailyPrompt.day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) : '';

  async function handleSubmitCanvas() {
    const imageBlob = await downloadCanvas();
    if (imageBlob) {
      submitPrompt(imageBlob)
        .then(() => clearCanvas())
        .catch((error) => {
          console.error("Failed to submit prompt:", error);
        });
    } else {
      console.error("Failed to download canvas");
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
                  <UserProfileIcon user={userProfile.user} onClick={() => navigate({ to: '/user-profile' })} />
              </div>
              <SubmissionFeedList />
          </div>
      );
    }

    return (
      <div className="flex flex-col items-center p-2 gap-4 bg-gray-100 pb-10 min-h-screen">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                <h1>Draw {dailyPrompt?.prompt}</h1>
                <p className="text-sm text-gray-500">
                  {formattedDate}
                </p>
              </div>
              <UserProfileIcon user={userProfile?.user} onClick={() => navigate({ to: '/user-profile' })} />
          </div>
          <Canvas ref={canvasRef} />
          <div className="flex gap-2 justify-center items-center border border-gray-200 rounded-2xl bg-gray-200 px-4 py-2 w-full max-w-md text-gray-500">
            <FontAwesomeIcon icon={faInfoCircle} />
            <p className="text-sm">
              Use today's three colors to draw the prompt
            </p>
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
    )
}

export default App
