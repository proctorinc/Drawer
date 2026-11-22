import { Link } from '@tanstack/react-router';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useFlair } from './useFlair';
import { UserProfileIcon } from './components/profile-icons/UserProfileIcon';
import type { FC } from 'react';
import type { Achievement, DecorationId } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Banner from '@/components/Banner';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import ShowAllLink from '@/components/ShowAllLink';
import { DECORATIONS } from '@/decorations/decorations';
import { achievementAnchor } from '@/pages/trophies/components/AchievementCard';
import { cn } from '@/utils';

// The avatar inside a tile would otherwise open your profile when tapped
const ignoreClick = () => {};

const tilts = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2'];

/**
 * One decoration on your face. Tapping an unlocked one opens the edit sheet
 * wearing it; a locked one jumps to the achievement that earns it.
 */
const FlairTile: FC<{
  id: DecorationId;
  index: number;
  unlocked: boolean;
  achievement?: Achievement;
}> = ({ id, index, unlocked, achievement }) => {
  const user = useUser();
  const wearing = user.decoration === id;
  const sticker = achievement?.name;
  const linkProps =
    !unlocked && achievement
      ? ({
          to: '/draw/achievements',
          search: { tab: achievement.category },
          hash: achievementAnchor(achievement),
          'aria-label': `${DECORATIONS[id].name} (locked): see how to earn the ${achievement.name} sticker`,
        } as const)
      : ({
          to: '/draw/profile/me',
          hash: 'decorations',
          search: { try: id },
          'aria-label': `try on ${DECORATIONS[id].name}${unlocked ? '' : ' (locked)'}`,
        } as const);

  return (
    <li className={cn('flex', tilts[index % tilts.length])}>
      <Link
        {...linkProps}
        className={cn(
          'press relative flex flex-col items-center gap-1.5 w-full p-3 text-center border-2 rounded-sketch-alt cursor-pointer hover:rotate-0',
          wearing ? 'bg-me border-ink' : 'bg-white border-ink',
          !unlocked && 'border-dashed border-pencil',
        )}
      >
        <span className={cn('flex', !unlocked && 'opacity-60')}>
          <UserProfileIcon
            user={{ ...user, decoration: id }}
            size="lg"
            onClick={ignoreClick}
            showLevel={false}
          />
        </span>
        <span className="font-accent font-bold text-lg leading-none">
          {DECORATIONS[id].name}
        </span>
        <span className="text-xs text-pencil leading-tight">
          {wearing
            ? 'wearing it'
            : unlocked
              ? 'tap to try it on'
              : `earn the ${sticker ?? 'matching'} sticker`}
        </span>
        {!unlocked && (
          <span className="absolute top-2 right-2 flex items-center justify-center size-5 rounded-full bg-ink text-white text-[10px]">
            <FontAwesomeIcon icon={faLock} />
          </span>
        )}
      </Link>
    </li>
  );
};

/** All the flair you can wear, unlocked or not, grouped by what earns it */
const DecorationsPage = () => {
  const { groups, isUnlocked, achievementFor, unlocked, available, isLoading } =
    useFlair();

  if (isLoading) return <LoadingScreen />;

  return (
    <Layout
      back
      header={
        <div className="flex items-end justify-between gap-2 w-full">
          <h1 className="font-accent font-bold text-[34px] leading-none truncate">
            my flair
          </h1>
          <span className="font-accent font-bold text-xl leading-none whitespace-nowrap">
            {unlocked}/{available}
          </span>
        </div>
      }
    >
      {groups.length === 0 ? (
        <Banner className="bg-paper border-dashed">
          no flair to wear yet. earn stickers to unlock some.
        </Banner>
      ) : (
        groups.map((group) => (
          <section key={group.name} className="flex flex-col gap-3 w-full">
            <h2 className="font-accent font-bold text-[28px] leading-none">
              {group.name}
            </h2>
            <ul className="grid grid-cols-2 gap-3 w-full">
              {group.ids.map((id, i) => (
                <FlairTile
                  key={id}
                  id={id}
                  index={i}
                  unlocked={isUnlocked(id)}
                  achievement={achievementFor(id)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      <ShowAllLink to="/draw/achievements">
        earn stickers to unlock more
      </ShowAllLink>
    </Layout>
  );
};

export default DecorationsPage;
