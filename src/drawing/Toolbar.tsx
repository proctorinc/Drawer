import { useEffect, useState } from 'react';
import { useDrawing } from './DrawingContext';
import { toolFeedback } from './feedback';
import type { FC, ReactNode } from 'react';
import { cn, dabShapes } from '@/utils';
import { EraserIcon, UndoIcon } from '@/components/icons';

type Props = {
  colors: Array<string>;
  /** Smaller tools, for sharing a row with the submit button on short screens */
  compact?: boolean;
  className?: string;
};

type ToolButtonProps = {
  label: string;
  compact?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

const ToolButton: FC<ToolButtonProps> = ({
  label,
  compact,
  isActive,
  disabled,
  onClick,
  children,
}) => (
  <button
    data-sound="off"
    aria-label={label}
    aria-pressed={isActive}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'press flex items-center justify-center border-2 border-ink rounded-sketch-alt shadow-pencil-sm cursor-pointer disabled:cursor-default disabled:opacity-35 disabled:shadow-none',
      compact ? 'size-10 max-[359px]:size-9' : 'size-[46px]',
      isActive ? 'bg-me -rotate-6' : 'bg-white',
    )}
  >
    {children}
  </button>
);

export const Toolbar: FC<Props> = ({ colors, compact = false, className }) => {
  const {
    selectedColor,
    setSelectedColor,
    selectEraser,
    undo,
    canUndo,
    hasInk,
  } = useDrawing();
  // Bumped on each undo so the arrow spins again
  const [undoSpin, setUndoSpin] = useState(0);
  const firstColor = colors.at(0);

  // Start with a color in hand rather than the eraser
  useEffect(() => {
    if (firstColor) setSelectedColor(firstColor);
  }, [firstColor, setSelectedColor]);

  // Nothing left to erase: hand back a color, so the next stroke shows
  useEffect(() => {
    if (!hasInk && selectedColor === null && firstColor) {
      setSelectedColor(firstColor);
    }
  }, [hasInk, selectedColor, firstColor, setSelectedColor]);

  return (
    <div
      className={cn(
        'flex items-center justify-between w-full',
        compact && 'gap-2',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center',
          compact ? 'gap-2 max-[359px]:gap-1.5' : 'gap-3',
        )}
      >
        {colors.map((color, index) => {
          const isSelected = selectedColor === color;
          return (
            <button
              key={`toolbar-color-${index}`}
              data-sound="off"
              aria-label={`Color ${index + 1}`}
              aria-pressed={isSelected}
              className={cn(
                compact
                  ? 'size-10 max-[359px]:size-9'
                  : colors.length > 3
                    ? 'size-[42px]'
                    : 'size-[50px]',
                'border-2 border-ink cursor-pointer transition-[scale,rotate,box-shadow] duration-300 ease-[var(--ease-spring)] active:scale-90 animate-in zoom-in-0 fill-mode-both',
                dabShapes[index % dabShapes.length],
                isSelected
                  ? 'scale-[1.12] -rotate-6 shadow-[0_0_0_3px_var(--color-paper),0_0_0_5px_var(--color-ink)]'
                  : 'hover:scale-105 hover:rotate-3',
              )}
              style={{
                backgroundColor: color,
                animationDelay: `${150 + index * 70}ms`,
              }}
              onClick={() => {
                if (!isSelected) toolFeedback.color(index);
                setSelectedColor(color);
              }}
            />
          );
        })}
      </div>
      <div className={cn('flex', compact ? 'gap-1.5' : 'gap-2')}>
        <ToolButton
          label="Eraser"
          compact={compact}
          isActive={!selectedColor}
          disabled={!hasInk}
          onClick={() => {
            if (selectedColor) toolFeedback.eraser();
            selectEraser();
          }}
        >
          <EraserIcon />
        </ToolButton>
        <ToolButton
          label="Undo"
          compact={compact}
          disabled={!canUndo}
          onClick={() => {
            toolFeedback.undo();
            undo();
            setUndoSpin((spin) => spin + 1);
          }}
        >
          <UndoIcon
            key={undoSpin}
            className={cn(
              undoSpin > 0 &&
                'animate-in spin-in-[-90deg] duration-300 ease-[var(--ease-spring)]',
            )}
          />
        </ToolButton>
      </div>
    </div>
  );
};
