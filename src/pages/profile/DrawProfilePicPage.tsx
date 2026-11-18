import { useState } from 'react';
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
      <div className="flex w-full justify-between items-center">
        <h1 className="font-accent font-bold text-[30px] leading-none">
          draw your face
        </h1>
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
          <h2 className="font-accent font-bold text-2xl">
            first, pick your skin color
          </h2>
          <Card className="w-fit">
            <CardContent className="flex-row">
              {skinColors.map((color, index) => (
                <button
                  key={`color-${index}`}
                  className={cn(
                    'size-10 border-2 border-ink cursor-pointer rounded-blob hover:scale-110 transition-[scale] duration-300 ease-[var(--ease-spring)]',
                    skinColorIndex === index &&
                      'ring-3 ring-coral ring-offset-2 scale-110',
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
            let's draw
          </Button>
        </div>
      )}
      <DrawingCanvas
        variant="round"
        colors={
          skinColorIndex !== null
            ? [skinColors[skinColorIndex], text, secondary, '#FFF']
            : []
        }
        backgroundColor={primary}
        className={cn('rounded-full', !readyToDraw && 'hidden')}
        onSubmit={uploadAvatar}
        submitLabel="save my avatar"
      />
      {readyToDraw && (
        <Disclaimer title="Tip: draw yourself, and fill the whole circle for best results">
          <DisclaimerItem>
            Or draw something else..? Idk, I don't make the rules 🤷🏻‍♂️
          </DisclaimerItem>
        </Disclaimer>
      )}
    </Layout>
  );
};

export default DrawProfilePicPage;
