import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';
import { cn } from '@/utils';
import type { UserPromptSubmission } from '@/api/Api';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from './Card';
import Button from './Button';

type Props = {
  drawing: UserPromptSubmission | null;
  onClose: () => void;
  initialPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};

const DrawingModal = ({ drawing, onClose, initialPosition }: Props) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (drawing) {
      // Small delay to ensure the animation plays
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [drawing]);

  if (!drawing || !initialPosition) return null;

  const formattedDate = new Date(drawing.day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300',
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'fixed inset-0 bg-primary-foreground/80 backdrop-blur-sm transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-500 transform',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        style={{
          transformOrigin: `${initialPosition.x + initialPosition.width / 2}px ${initialPosition.y + initialPosition.height / 2}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="pb-0">
          <CardHeader title={drawing.prompt} subtitle={formattedDate}>
            <Button
              size="sm"
              className="rounded-full aspect-square"
              disableLoad
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} />
            </Button>
          </CardHeader>
        </CardContent>
        <CanvasRenderer
          canvasData={drawing.canvasData}
          className="w-full aspect-square border-t-2 border-border"
        />
      </Card>
    </div>
  );
};

export default DrawingModal;
