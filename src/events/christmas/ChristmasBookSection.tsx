import { useChristmas } from '../useChristmas';
import ChristmasTree from './ChristmasTree';
import EventSticker from './EventSticker';
import { useGetAchievements } from '@/api/Api';

/** "Your tree" on My Book: ornaments for days drawn, plus event stickers */
const ChristmasBookSection = () => {
  const christmas = useChristmas();
  const { data: achievements } = useGetAchievements();
  if (!christmas?.countdownDays) return null;

  const stickers =
    achievements?.achievements.filter(
      (achievement) => achievement.eventSlug === christmas.slug,
    ) ?? [];

  return (
    <section className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          your tree
        </h2>
        <span className="text-pencil text-[17px]">
          {christmas.progress.count} of {christmas.countdownDays} ornaments
        </span>
      </div>
      <ChristmasTree event={christmas} className="self-center" />
      {stickers.length > 0 && (
        <ul className="flex justify-center gap-4 pt-1 stagger">
          {stickers.map((sticker) => (
            <li
              key={sticker.id}
              className="flex flex-col items-center gap-1 w-20 text-center text-sm leading-tight"
            >
              <EventSticker
                achievement={sticker}
                locked={!sticker.achievedAt}
                className="w-12 h-13"
              />
              <span className={sticker.achievedAt ? '' : 'text-pencil'}>
                {sticker.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ChristmasBookSection;
