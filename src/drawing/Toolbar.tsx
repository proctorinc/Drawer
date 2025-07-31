import { faEraser, faUndo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDrawing } from './DrawingContext';
import type { FC } from 'react';
import { cn } from '@/utils';
import { Card, CardContent } from '@/components/Card';

type Props = {
  colors: Array<string>;
};

export const Toolbar: FC<Props> = ({ colors }) => {
  const { selectedColor, setSelectedColor, selectEraser, undo, canUndo } =
    useDrawing();

  return (
    <Card>
      <CardContent className="flex flex-row justify-between items-center w-full">
        <div className="flex gap-4 flex-wrap">
          {colors.map((color, index) => (
            <button
              key={`toolbar-color-${index}`}
              className={cn(
                'w-10 h-10 border-2 border-primary cursor-pointer rounded-md hover:opacity-80 hover:scale-110 transition-all duration-300',
                selectedColor === color && 'ring-4 ring-primary border-none',
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
              'w-10 h-10 cursor-pointer disabled:cursor-default rounded-md disabled:opacity-30 disabled:scale-100 bg-base text-primary hover:opacity-80 hover:scale-110 transition-all duration-300',
              !selectedColor && 'ring-4 ring-primary',
            )}
          >
            <FontAwesomeIcon icon={faEraser} />
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-10 h-10 cursor-pointer disabled:cursor-default rounded-md disabled:opacity-30 disabled:scale-100 bg-base text-primary hover:opacity-80 hover:scale-110 transition-all duration-300"
          >
            <FontAwesomeIcon icon={faUndo} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
