import { queryKeys, useSwapFavoriteOrder, type GetMeResponse } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Banner from '@/components/Banner';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { cn } from '@/utils';
import {
  faCheckCircle,
  faEdit,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faTrophy } from '@fortawesome/free-solid-svg-icons/faTrophy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FC } from 'react';

type Props = {
  profile?: GetMeResponse;
};

const FavoriteSubmissions: FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const swapFavorites = useSwapFavoriteOrder();

  const favorites = profile?.favorites;
  const isMe = currentUser.id === profile?.user.id;
  const canEdit = !!favorites?.length && favorites?.length > 0 && isMe;

  function handleEditToggle() {
    setIsEditing((prev) => !prev);
    setSelectedId(null);
  }

  function handleImageClick(id: string) {
    if (selectedId && selectedId !== id) {
      swapFavorites.mutate(
        { id1: selectedId, id2: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
          },
        },
      );
      setSelectedId(null);
    } else if (!selectedId) {
      setSelectedId(id);
    } else if (selectedId === id) {
      setSelectedId(null);
    }
  }

  return (
    <div className="relative flex flex-col gap-2 w-full">
      <div className="flex justify-between text-lg font-bold text-primary text-left w-full">
        {canEdit && (
          <Button
            size="sm"
            className="absolute top-0 right-0"
            icon={isEditing ? faCheckCircle : faEdit}
            disableLoad
            onClick={handleEditToggle}
          ></Button>
        )}
      </div>
      {isEditing && (
        <Banner icon={faInfoCircle} className="text-center mt-8">
          Tap to swap drawings
        </Banner>
      )}
      <div className="flex flex-row gap-1.5 w-full justify-between items-end font-bold">
        {favorites?.slice(0, 3).map((favorite, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col items-center gap-2',
              i === 1 ? 'w-1/2' : 'w-2/5',
            )}
          >
            {i === 0 && (
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-300 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] border-2 border-gray-400 shadow-gray-400 text-gray-500">
                2
              </div>
            )}
            {i === 1 && (
              <div className="relative">
                <FontAwesomeIcon
                  className="text-yellow-400 text-5xl"
                  icon={faTrophy}
                />
                <p className="text-yellow-700 absolute left-1/2 top-[18px] -translate-x-1/2 -translate-y-1/2">
                  1
                </p>
              </div>
              // <div className="flex items-center justify-center w-9 h-9 rounded-full bg-yellow-300 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] border-2 border-yellow-400 shadow-yellow-400 text-yellow-600">
              //   1
              // </div>
            )}
            {i === 2 && (
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-400 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] border-2 border-amber-500 shadow-amber-500 text-amber-700">
                3
              </div>
            )}
            <Card key={favorite.id}>
              <DrawingImage
                imageUrl={favorite.submission.imageUrl}
                onClick={() =>
                  isEditing
                    ? handleImageClick(favorite.id)
                    : navigate({
                        to: `/draw/submission/${favorite.submission.id}`,
                      })
                }
                style={{
                  border:
                    selectedId === favorite.id
                      ? '3px solid #0070f3'
                      : undefined,
                  boxShadow:
                    selectedId === favorite.id
                      ? '0 0 0 4px #0070f355'
                      : undefined,
                  transition: 'box-shadow 0.2s, border 0.2s',
                  cursor: isEditing ? 'pointer' : undefined,
                }}
              />
            </Card>
          </div>
        ))}
        {favorites?.length === 0 && (
          <Card>
            <CardContent className="text-center font-bold text-secondary">
              No favorite doodles yet
            </CardContent>
          </Card>
        )}
      </div>
      {/* <div className="flex justify-between px-4">
        <div className="w-14 h-14 rounded-full bg-yellow-300"></div>
        <div className="w-14 h-14 rounded-full bg-yellow-300"></div>
        <div className="w-14 h-14 rounded-full bg-yellow-300"></div>
      </div> */}
      {isEditing && (
        <>
          <span className="font-bold pt-4 text-primary">Other Favorites</span>
          <div className="grid grid-cols-2 gap-4 w-full">
            {favorites?.slice(3).map((favorite) => (
              <Card key={favorite.id}>
                <DrawingImage
                  imageUrl={favorite.submission.imageUrl}
                  onClick={() =>
                    isEditing
                      ? handleImageClick(favorite.id)
                      : navigate({
                          to: `/draw/submission/${favorite.submission.id}`,
                        })
                  }
                  style={{
                    border:
                      selectedId === favorite.id
                        ? '3px solid #0070f3'
                        : undefined,
                    boxShadow:
                      selectedId === favorite.id
                        ? '0 0 0 4px #0070f355'
                        : undefined,
                    transition: 'box-shadow 0.2s, border 0.2s',
                    cursor: isEditing ? 'pointer' : undefined,
                  }}
                />
              </Card>
            ))}
          </div>
          {favorites?.slice(3).length === 0 && (
            <Card>
              <CardContent className="text-center font-bold text-secondary">
                Extra doodles that you favorite will show up here!
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default FavoriteSubmissions;
