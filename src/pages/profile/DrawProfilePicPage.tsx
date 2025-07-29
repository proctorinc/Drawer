import { useEffect, useState } from 'react';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import DrawingCanvas from '../feed/components/DrawingCanvas';
import { useMyProfilePage } from './context/MyProfileContext';
import Layout from '@/components/Layout';
import { cn, nameToColor } from '@/utils';
import { Card, CardContent } from '@/components/Card';
import Button from '@/components/Button';
import Disclaimer, { DisclaimerItem } from '@/components/Disclaimer';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useDrawing } from '@/drawing/DrawingContext';

const DrawProfilePicPage = () => {
  const { profile, uploadAvatar } = useMyProfilePage();
  const { primary, secondary, text } = nameToColor(
    profile?.user.username ?? '',
  );
  const { clearCanvas } = useDrawing();
  const [skinColorIndex, setSkinColorIndex] = useLocalStorage<number | null>(
    'SKIN_COLOR',
    null,
  );
  const [readyToDraw, setReadyToDraw] = useState(skinColorIndex !== null);
  const skinColors = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];

  return (
    <Layout back>
      <div className="flex w-full font-bold justify-between items-center h-5">
        <h2 className="text-xl text-primary">Draw your profile picture</h2>
        {readyToDraw && skinColorIndex !== null && (
          <Button
            size="sm"
            style={{ backgroundColor: skinColors[skinColorIndex] }}
            icon={faEdit}
            onClick={() => setReadyToDraw(false)}
          ></Button>
        )}
      </div>
      {!readyToDraw && (
        <div className="flex flex-col flex-grow justify-center items-center gap-4 p-4">
          <div className="flex w-full justify-center font-bold">
            <h3 className="text-primary">Select your skin color</h3>
          </div>
          <Card className="w-fit">
            <CardContent className="flex-row">
              {skinColors.map((color, index) => (
                <button
                  key={`color-${index}`}
                  className={cn(
                    'w-10 h-10 border-2 border-primary cursor-pointer rounded-md hover:opacity-80 hover:scale-110 transition-all duration-300',
                    skinColorIndex === index &&
                      'ring-4 ring-primary border-none',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSkinColorIndex(index)}
                />
              ))}
            </CardContent>
          </Card>
          <Button
            disabled={skinColorIndex === null}
            onClick={() => {
              clearCanvas();
              setReadyToDraw(true);
            }}
          >
            Select
          </Button>
        </div>
      )}
      <DrawingCanvas
        variant="round"
        colors={
          skinColorIndex !== null
            ? [skinColors[skinColorIndex], secondary, text]
            : []
        }
        downloadEnabled
        backgroundColor={primary}
        className={cn('rounded-full', !readyToDraw && 'hidden')}
        onSubmit={uploadAvatar}
      />
      {readyToDraw && (
        <Disclaimer title="Tip: Draw a picture of yourself, try and fill the whole circle for best results">
          <DisclaimerItem>
            Or draw something else..? Idk, I don't make the rules 🤷🏻‍♂️
          </DisclaimerItem>
        </Disclaimer>
      )}
    </Layout>
  );
};

export default DrawProfilePicPage;
