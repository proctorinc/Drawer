import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useGetUserAchievements } from './api';
import { useBookOwner } from './useBookOwner';
import { earnedNewestFirst } from './components/StickerBook';
import { useGetAchievements } from '@/api/Api';
import Banner from '@/components/Banner';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import ShowAllLink from '@/components/ShowAllLink';
import {
  AchievementSticker,
  stickerAnchor,
} from '@/pages/trophies/components/AchievementCard';

/** Every sticker someone's earned, newest first */
const StickersPage = () => {
  const { isMe, userId, profile } = useBookOwner();
  const mine = useGetAchievements();
  const theirs = useGetUserAchievements(isMe ? '' : userId);
  const achievements = isMe ? mine.data?.achievements : theirs.data;
  const isLoading = isMe ? mine.isLoading : theirs.isLoading;
  const linkedSticker = useLocation().hash.replace(/^#/, '');

  // Links like .../stickers#sticker-12 land on that sticker. The router
  // scrolls to the hash itself, but only if the sticker was already rendered.
  useEffect(() => {
    if (achievements && linkedSticker) {
      document
        .getElementById(linkedSticker)
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [achievements, linkedSticker]);

  if (isLoading) return <LoadingScreen />;

  if (!achievements) {
    return (
      <Layout back>
        <Banner className="bg-paper border-dashed">
          the sticker book is stuck shut. try again in a bit?
        </Banner>
      </Layout>
    );
  }

  const earned = earnedNewestFirst(achievements);
  const name = isMe ? 'my' : profile ? `${profile.user.username}'s` : 'their';

  return (
    <Layout
      back
      header={
        <div className="flex items-end justify-between gap-2 w-full">
          <h1 className="font-accent font-bold text-[34px] leading-none truncate">
            {name} stickers
          </h1>
          <span className="font-accent font-bold text-xl leading-none whitespace-nowrap">
            {earned.length}/{achievements.length}
          </span>
        </div>
      }
    >
      <ShowAllLink to="/draw/achievements">
        {isMe ? 'earn more stickers' : 'how stickers are earned'}
      </ShowAllLink>
      {earned.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 w-full p-4 pt-5 bg-white border-2 border-ink rounded-sketch shadow-pencil">
          {earned.map((achievement, i) => (
            <AchievementSticker
              key={achievement.id}
              achievement={achievement}
              index={i}
              highlighted={stickerAnchor(achievement) === linkedSticker}
            />
          ))}
        </ul>
      ) : (
        <Banner className="bg-paper border-dashed">
          {isMe
            ? 'No stickers yet. Your first one is a single drawing away.'
            : 'no stickers yet.'}
        </Banner>
      )}
    </Layout>
  );
};

export default StickersPage;
