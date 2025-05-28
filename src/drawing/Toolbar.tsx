import { faEraser, faUndo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDrawing } from './DrawingContext';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { cn } from '@/utils';

export const Toolbar = () => {
  const { dailyPrompt } = useDailyPrompt();
  const { selectedColor, setSelectedColor, selectEraser, undo, canUndo } =
    useDrawing();

  return (
    <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md">
      <div className="flex gap-4">
        {dailyPrompt?.colors.map((color) => (
          <button
            className={cn(
              'w-10 h-10 cursor-pointer rounded-md hover:opacity-80 hover:scale-110 transition-all duration-300',
              selectedColor === color ? 'ring-3 ring-white' : '',
            )}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          ></button>
        ))}
      </div>
      <div className="flex gap-4">
        <button
          onClick={selectEraser}
          disabled={!canUndo}
          className={cn(
            'w-10 h-10 cursor-pointer disabled:cursor-default rounded-md disabled:opacity-30 disabled:scale-100 bg-white hover:opacity-80 hover:scale-110 transition-all duration-300',
            selectedColor ? '' : 'ring-3 ring-blue-500',
          )}
        >
          <FontAwesomeIcon icon={faEraser} />
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          className="w-10 h-10 cursor-pointer disabled:cursor-default rounded-md disabled:opacity-30 disabled:scale-100 bg-white hover:opacity-80 hover:scale-110 transition-all duration-300"
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>
      </div>
    </div>
  );
};
