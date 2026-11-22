import { Link } from '@tanstack/react-router';
import { UserProfileIcon } from './profile-icons/UserProfileIcon';
import type { FC } from 'react';
import useUser from '@/auth/hooks/useUser';
import { SectionLink } from '@/components/ShowAllLink';
import { DECORATIONS } from '@/decorations/decorations';
import { useFlair } from '@/pages/profile/useFlair';
import { cn } from '@/utils';

/** How many of the newest flair your profile shows */
export const RECENT_FLAIR = 3;

const tilts = ['-rotate-2', 'rotate-1', '-rotate-1'];

// The avatar inside a tile would otherwise open your profile when tapped
const ignoreClick = () => {};

/** Your newest few flair, each on your face; tapping one tries it on */
const FlairShelf: FC = () => {
  const user = useUser();
  const { recent, unlocked, available, isLoading } = useFlair();

  if (isLoading || available === 0) return null;

  return (
    <section className="flex flex-col gap-4 w-full">
      <SectionLink
        to="/draw/profile/me/decorations"
        heading="my flair"
        label={`see all ${unlocked}/${available}`}
      />
      {recent.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 w-full p-4 bg-white border-2 border-ink rounded-sketch">
          {recent.slice(0, RECENT_FLAIR).map((id, i) => (
            <li key={id} className={cn('flex', tilts[i % tilts.length])}>
              <Link
                to="/draw/profile/me"
                hash="decorations"
                search={{ try: id }}
                aria-label={`try on ${DECORATIONS[id].name}`}
                className={cn(
                  'press flex flex-col items-center gap-1.5 w-full p-2 text-center border-2 border-ink rounded-sketch-alt cursor-pointer hover:rotate-0',
                  user.decoration === id ? 'bg-me' : 'bg-paper',
                )}
              >
                <UserProfileIcon
                  user={{ ...user, decoration: id }}
                  size="lg"
                  onClick={ignoreClick}
                  showLevel={false}
                />
                <span className="font-accent font-bold text-base leading-none">
                  {DECORATIONS[id].name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="w-full p-4 text-center text-pencil bg-white border-2 border-dashed border-pencil rounded-sketch">
          No flair yet. Earn stickers to unlock some.
        </p>
      )}
    </section>
  );
};

export default FlairShelf;
