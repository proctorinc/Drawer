import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import type { FavoriteSubmission, GetMeResponse } from '@/api/Api';
import { queryKeys, useSwapFavoriteOrder } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Banner from '@/components/Banner';
import Button from '@/components/Button';
import { StarIcon } from '@/components/icons';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { cn } from '@/utils';

// Podium order, left to right: 2nd, 1st, 3rd
const PODIUM = [
  { index: 1, medal: 'bg-sky', tilt: '-rotate-3', width: 'w-[30%]' },
  { index: 0, medal: 'bg-butter', tilt: 'rotate-1', width: 'w-[40%]' },
  { index: 2, medal: 'bg-blush', tilt: 'rotate-3', width: 'w-[30%]' },
];

type FrameProps = {
  favorite: FavoriteSubmission;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
};

const FavoriteFrame: FC<FrameProps> = ({
  favorite,
  isSelected,
  onClick,
  className,
}) => {
  const isLocked = useIsDrawingLocked()(favorite.submission);

  return (
    <button
      onClick={onClick}
      aria-label={favorite.submission.prompt}
      aria-pressed={isSelected}
      className={cn(
        'block w-full p-1.5 bg-white shadow-[1px_2px_6px_rgba(43,42,51,0.18)] cursor-pointer transition-[rotate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 active:scale-95',
        isSelected &&
          'rotate-0 scale-105 outline-3 outline-dashed outline-coral',
        className,
      )}
    >
      {isLocked ? (
        <LockedDrawing />
      ) : (
        <DrawingImage
          imageUrl={favorite.submission.imageUrl}
          draggable={false}
          className="bg-[#fff8ec]"
        />
      )}
    </button>
  );
};

type Props = {
  profile: GetMeResponse;
};

/** The owner's top three doodles on a little podium */
const FavoriteSubmissions: FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const swapFavorites = useSwapFavoriteOrder();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { favorites } = profile;
  const isMe = currentUser.id === profile.user.id;

  if (favorites.length === 0 && !isMe) {
    return null;
  }

  function handleClick(favorite: FavoriteSubmission) {
    if (!isEditing) {
      navigate({
        to: '/draw/submission/$submissionId',
        params: { submissionId: favorite.submission.id },
      });
    } else if (!selectedId) {
      setSelectedId(favorite.id);
    } else if (selectedId === favorite.id) {
      setSelectedId(null);
    } else {
      swapFavorites.mutate(
        { id1: selectedId, id2: favorite.id },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: queryKeys.myProfile }),
        },
      );
      setSelectedId(null);
    }
  }

  function frameProps(favorite: FavoriteSubmission) {
    return {
      favorite,
      isSelected: selectedId === favorite.id,
      onClick: () => handleClick(favorite),
    };
  }

  return (
    <section className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          hall of fame
        </h2>
        {isMe && favorites.length > 1 && (
          <Button
            size="sm"
            variant={isEditing ? 'primary' : 'base'}
            disableLoad
            onClick={() => {
              setIsEditing((prev) => !prev);
              setSelectedId(null);
            }}
          >
            {isEditing ? 'done' : 'rearrange'}
          </Button>
        )}
      </div>

      {favorites.length === 0 && (
        <Banner className="bg-paper border-dashed">
          <StarIcon size={16} strokeWidth={2.2} />
          star your best doodles to hang them here
        </Banner>
      )}
      {isEditing && <Banner>tap two doodles to swap their spots</Banner>}
      {swapFavorites.isError && (
        <Banner className="bg-blush">that swap didn't stick. try again?</Banner>
      )}

      {favorites.length > 0 && (
        <div className="flex items-end justify-center gap-3 pt-2">
          {PODIUM.map(({ index, medal, tilt, width }) => (
            <div
              key={index}
              className={cn('flex flex-col items-center gap-2', width)}
            >
              {favorites[index] && (
                <>
                  <span
                    className={cn(
                      'flex items-center justify-center border-2 border-ink rounded-blob font-accent font-bold',
                      medal,
                      index === 0 ? 'size-11 text-2xl' : 'size-9 text-xl',
                    )}
                  >
                    {index + 1}
                  </span>
                  <FavoriteFrame
                    {...frameProps(favorites[index])}
                    className={tilt}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing && favorites.length > 3 && (
        <>
          <span className="text-pencil">the runners-up</span>
          <div className="grid grid-cols-4 gap-3">
            {favorites.slice(3).map((favorite) => (
              <FavoriteFrame key={favorite.id} {...frameProps(favorite)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FavoriteSubmissions;
