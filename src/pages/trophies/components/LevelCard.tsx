import ProgressBar from './ProgressBar';
import type { FC, ReactNode } from 'react';
import type { TrophiesResponse } from '@/api/trophies';
import { FlameIcon, PencilIcon, StarIcon } from '@/components/icons';
import { cn } from '@/utils';

const levelTitles = [
  'Doodler',
  'Scribbler',
  'Sketcher',
  'Inker',
  'Shader',
  'Illustrator',
  'Art Goblin',
  'Picasso-ish',
  'Pencil Legend',
];

const levelTitle = (level: number) =>
  levelTitles[Math.min(level, levelTitles.length) - 1];

const StatSticker: FC<{
  icon: ReactNode;
  value: number;
  label: string;
  className: string;
}> = ({ icon, value, label, className }) => (
  <div
    className={cn(
      'flex flex-col items-center flex-1 py-2 border-2 border-ink rounded-sketch shadow-pencil-sm',
      className,
    )}
  >
    <span className="flex items-center gap-1 font-accent font-bold text-[28px] leading-none">
      {icon}
      {value}
    </span>
    <span className="text-sm text-pencil">{label}</span>
  </div>
);

type Props = {
  trophies: TrophiesResponse;
  stickerCount: number;
};

const LevelCard: FC<Props> = ({ trophies, stickerCount }) => {
  const { level, xp, levelStartXp, nextLevelXp } = trophies.level;

  return (
    <section className="flex flex-col gap-4 w-full">
      <div className="relative flex flex-col gap-3 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch shadow-pencil">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 -ml-8 w-16 h-5 bg-sky/90 rotate-2"
        />
        <div className="flex items-center gap-4">
          <div className="relative grid place-items-center size-20 shrink-0 bg-butter border-2 border-ink rounded-blob -rotate-6 animate-drop">
            <span className="font-accent font-bold text-[44px] leading-none">
              {level}
            </span>
            <span className="absolute -bottom-2 px-1.5 bg-coral text-white text-xs border-2 border-ink rounded-sketch rotate-3">
              LEVEL
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-lg text-pencil">you are a…</span>
            <h1 className="font-accent font-bold text-[36px] leading-none">
              <span className="highlight">
                {levelTitle(level).toLowerCase()}
              </span>
            </h1>
          </div>
        </div>
        <ProgressBar
          value={xp - levelStartXp}
          max={nextLevelXp - levelStartXp}
          label={`Level ${level} progress`}
          className="h-5"
        />
        <div className="flex justify-between gap-2 text-pencil">
          <span>{xp} XP</span>
          <span className="text-right">
            {nextLevelXp - xp} XP to{' '}
            <span className="text-ink">
              {levelTitle(level + 1).toLowerCase()}
            </span>
          </span>
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <StatSticker
          icon={
            <FlameIcon size={22} className="animate-flicker origin-bottom" />
          }
          value={trophies.currentStreak}
          label="day streak"
          className="bg-blush -rotate-2"
        />
        <StatSticker
          icon={<PencilIcon size={22} />}
          value={trophies.lifetime.drawings}
          label="drawings"
          className="bg-sky rotate-1"
        />
        <StatSticker
          icon={<StarIcon size={22} fill="white" />}
          value={stickerCount}
          label="stickers"
          className="bg-butter -rotate-1"
        />
      </div>
    </section>
  );
};

export default LevelCard;
