import { useRef, useState } from 'react';
import { DrawingImage } from './DrawingImage';
import { LockedDrawing } from './LockedDrawing';
import type { FC } from 'react';
import type {UserPromptSubmission} from '@/api/Api';
import { Card } from '@/components/Card';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type Props = {
  submission: UserPromptSubmission;
  className?: string;
  onClick?: () => void;
};

const LONG_PRESS_DURATION = 200; // ms

const DrawingFeedImage: FC<Props> = ({ submission, onClick, className }) => {
  const isLocked = useIsDrawingLocked()(submission);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Handlers for pointer events
  const handlePointerDown = () => {
    longPressTriggered.current = false;
    longPressTimeout.current = setTimeout(() => {
      setOverlaysVisible(false);
      longPressTriggered.current = true;
    }, LONG_PRESS_DURATION);
  };

  const handlePointerUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (longPressTriggered.current) {
      setOverlaysVisible(true);
      // Don't trigger click
    } else {
      // Trigger click if not a long press
      onClick?.();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    if (e.pointerType !== 'touch') {
      setOverlaysVisible(true);
    }
  };

  return (
    <Card
      key={`${submission.user.id}-${submission.day}`}
      className={cn(
        'flex items-center relative bg-card rounded-2xl border-2 border-border select-none',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
    >
      {isLocked ? (
        <LockedDrawing />
      ) : (
        <DrawingImage
          imageUrl={submission.imageUrl}
          className={cn(
            'select-none',
            !overlaysVisible && 'pointer-events-none',
          )}
          draggable={false}
        />
      )}
      {/* Unified overlays container */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-200',
          !overlaysVisible && 'opacity-0 pointer-events-none',
        )}
        style={{ zIndex: 2 }}
      >
        {/* Top right overlays */}
        <div
          id="hoverings"
          className="flex flex-col gap-2 absolute top-2 right-2 pointer-events-auto"
        >
          <UserProfileIcon user={submission.user} />
        </div>
      </div>
    </Card>
  );
};

export default DrawingFeedImage;
