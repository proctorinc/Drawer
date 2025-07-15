import {
  queryKeys,
  useSwapFavoriteOrder,
  type FavoriteSubmission,
} from '@/api/Api';
import Banner from '@/components/Banner';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import {
  faCheckCircle,
  faEdit,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FC } from 'react';

type Props = {
  favorites?: Array<FavoriteSubmission>;
};

const FavoriteSubmissions: FC<Props> = ({ favorites }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const swapFavorites = useSwapFavoriteOrder();

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
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between text-lg font-bold text-primary text-left w-full">
        <h2>Favorite doodles</h2>
        <Button
          size="sm"
          icon={isEditing ? faCheckCircle : faEdit}
          disableLoad
          onClick={handleEditToggle}
        ></Button>
      </div>
      {isEditing && (
        <div className="flex flex-col gap-4 pt-4">
          <Banner icon={faInfoCircle} className="text-center">
            Tap to swap drawings
          </Banner>
          <span className="font-bold text-primary">Top 3 Favorites</span>
        </div>
      )}
      <div className="flex flex-row gap-4 w-full justify-between">
        {favorites?.slice(0, 3).map((favorite) => (
          <Card className="w-1/3" key={favorite.id}>
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
                  selectedId === favorite.id ? '3px solid #0070f3' : undefined,
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
        {favorites?.length === 0 && (
          <Card>
            <CardContent className="text-center font-bold text-secondary">
              No favorite doodles yet
            </CardContent>
          </Card>
        )}
      </div>
      {isEditing && (
        <>
          <span className="font-bold pt-4 text-primary">Other Favorites</span>
          <div className="grid grid-cols-2 gap-4">
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
        </>
      )}
    </div>
  );
};

export default FavoriteSubmissions;
