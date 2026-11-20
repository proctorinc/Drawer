import { useState } from 'react';
import type { FC } from 'react';
import type { Announcement } from './api';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { useTodaysJudge } from '@/ai/TodaysJudge';
import LogoIcon from '@/components/logo/LogoIcon';
import { SantaHatIcon, TreeIcon } from '@/events/christmas/Decorations';
import Lights from '@/events/christmas/Lights';

/** Today's judge, a scorecard and a word bubble: flat, with ink outlines */
const AIJudgesArt: FC = () => {
  const { data } = useTodaysJudge();
  const judge = data?.judge ?? {
    name: 'Judge',
    avatarUrl: '',
    decoration: '',
  };

  return (
    <span className="relative grid place-items-center w-64 h-52">
      <span className="absolute right-0 top-2 max-w-[9.5rem] px-3 py-2 bg-white border-2 border-ink rounded-sketch text-left leading-tight rotate-3">
        hmm. bold choice.
        <span className="absolute -bottom-[9px] left-6 size-4 bg-white border-r-2 border-b-2 border-ink rotate-45" />
      </span>
      <span className="mt-10 scale-[1.6]">
        <AIJudgeAvatar judge={judge} size="xl" />
      </span>
      <span className="absolute left-0 bottom-2 flex flex-col items-center px-3 py-1.5 bg-butter border-2 border-ink rounded-sketch-alt -rotate-6">
        <b className="font-accent font-bold text-3xl leading-none">7.5</b>
        <span className="text-xs uppercase tracking-wider">out of 10</span>
      </span>
    </span>
  );
};

/** A string of lights over a tree and a hat; deliberately vague about what's coming */
const ChristmasArt: FC = () => (
  <span className="flex flex-col items-center w-64">
    <Lights bulbs={9} className="w-full" />
    <span className="flex items-end gap-4 mt-4">
      <SantaHatIcon size={64} className="-rotate-12" />
      <TreeIcon size={96} className="text-ink" />
      <span className="font-accent font-bold text-5xl leading-none text-xmas-red rotate-6">
        ?
      </span>
    </span>
  </span>
);

const ImageArt: FC<{ url: string }> = ({ url }) => {
  const [broken, setBroken] = useState(false);
  if (broken) return <LogoIcon theme={null} size={120} />;
  return (
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      className="max-h-56 max-w-full object-contain bg-white border-2 border-ink rounded-sketch"
    />
  );
};

/** The picture at the top of an announcement */
const AnnouncementArt: FC<{ announcement: Announcement }> = ({
  announcement,
}) => {
  switch (announcement.art) {
    case 'ai_judges':
      return <AIJudgesArt />;
    case 'christmas':
      return <ChristmasArt />;
    case 'image':
      return <ImageArt url={announcement.imageUrl} />;
    default:
      return <LogoIcon theme={null} size={120} />;
  }
};

export default AnnouncementArt;
