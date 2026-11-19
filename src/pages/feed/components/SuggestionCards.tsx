import { Link } from '@tanstack/react-router';
import { pickTips } from '../tips';
import type { LinkProps } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import type { Tip } from '../tips';
import type { DecorationId } from '@/api/Api';
import { useGetAchievements } from '@/api/Api';
import { useActiveEvent } from '@/api/events';
import useUser from '@/auth/hooks/useUser';
import { PencilIcon, TrophyIcon } from '@/components/icons';
import { DECORATIONS } from '@/decorations/decorations';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useFriendInvites } from '@/pages/profile/components/friends/useFriendInvites';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import Badge from '@/pages/trophies/components/Badge';
import { cn, tapeColor } from '@/utils';

const TAPES = ['#ff6b57', '#3a7bd5', '#ffb400'];

const IconArt: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="flex items-center justify-center size-12 bg-butter border-2 border-ink rounded-sketch-alt rotate-3">
    {children}
  </span>
);

type TipView = {
  art: ReactNode;
  title: ReactNode;
  action: string;
  /** Where the action goes: the page, and the sheet or spot on it, via the hash */
  to: LinkProps;
};

/** What a tip looks like and where its button takes you */
function viewOf(tip: Tip, user: ReturnType<typeof useUser>): TipView {
  switch (tip.kind) {
    case 'invite':
      return {
        art: <UserProfileIcon user={tip.from} />,
        title: (
          <>
            <b>{tip.from.username}</b> wants to be friends!
          </>
        ),
        action: 'answer',
        to: { to: '/draw/profile/me', hash: 'friends' },
      };
    case 'sticker':
      return {
        art: <Badge achievement={tip.sticker} className="size-12" />,
        title: (
          <>
            you earned the <b>{tip.sticker.name}</b> sticker!
          </>
        ),
        action: 'see it',
        to: { to: '/draw/trophies', hash: `sticker-${tip.sticker.id}` },
      };
    case 'decoration':
      return {
        art: <UserProfileIcon user={{ ...user, decoration: tip.decoration }} />,
        title: (
          <>
            you unlocked <b>{DECORATIONS[tip.decoration].name}</b> for your face
          </>
        ),
        action: 'try it on',
        to: { to: '/draw/profile/me', hash: 'decorations' },
      };
    case 'face':
      return {
        art: (
          <IconArt>
            <PencilIcon size={24} />
          </IconArt>
        ),
        title: 'you can draw your own face now. show us!',
        action: 'draw my face',
        to: { to: '/draw/profile/pic' },
      };
    case 'event':
      return {
        art: (
          <IconArt>
            <TrophyIcon size={24} />
          </IconArt>
        ),
        title: (
          <>
            <b>{tip.name}</b> is on! come see what's new
          </>
        ),
        action: 'take a look',
        to: { to: '/draw/event/$slug', params: { slug: tip.slug } },
      };
    case 'friends':
      return {
        art: (
          <IconArt>
            <span className="text-2xl leading-none">+</span>
          </IconArt>
        ),
        title: "doodling's better with more friends",
        action: 'invite some',
        to: { to: '/draw/profile/me', hash: 'friends' },
      };
  }
}

type CardProps = TipView & {
  index: number;
  /** Going there or closing the card both count as having seen it */
  onSeen: () => void;
};

/** A little taped-up note with a picture, a line and a button that takes you there */
const TipCard: FC<CardProps> = ({ index, art, title, action, to, onSeen }) => (
  <li
    className={cn(
      'relative flex-none flex gap-3 w-64 p-3 pt-4 bg-white shadow-[1px_2px_6px_rgba(43,42,51,0.18)] snap-start animate-drop',
      index % 2 ? 'rotate-1' : '-rotate-1',
    )}
    style={{ animationDelay: `${index * 90}ms` }}
  >
    <span
      aria-hidden="true"
      className="absolute -top-2 left-6 w-12 h-4 -rotate-3"
      style={{ backgroundColor: tapeColor(TAPES[index % TAPES.length]) }}
    />
    <button
      aria-label="Close"
      onClick={onSeen}
      className="absolute top-0.5 right-1.5 size-7 text-xl leading-none text-pencil cursor-pointer"
    >
      ×
    </button>
    <span className="flex flex-none items-center justify-center size-12">
      {art}
    </span>
    <div className="flex flex-col items-start gap-1.5 min-w-0 pr-4">
      <p className="leading-tight">{title}</p>
      <Link
        {...to}
        onClick={onSeen}
        className="press inline-flex items-center h-8 px-3 bg-ink text-paper border-2 border-ink rounded-sketch leading-none"
      >
        {action}
      </Link>
    </div>
  </li>
);

/** Little cards nudging you toward things you haven't tried yet */
export const SuggestionCards = () => {
  const user = useUser();
  const { profile, customAvatarIsUnlocked } = useMyProfilePage();
  const { data: achievementsData } = useGetAchievements();
  const { data: event } = useActiveEvent();
  const { incoming } = useFriendInvites();
  const [seen, setSeen] = useLocalStorage<Array<string>>(
    'HOME_TIPS_SEEN',
    [],
    0,
  );

  const unlockedDecorations = (
    Object.keys(DECORATIONS) as Array<DecorationId>
  ).filter((id) => achievementsData?.rewards.has(id));

  const tips = pickTips({
    incomingInvites: incoming.map((invite) => invite.inviter),
    achievements: achievementsData?.achievements ?? [],
    unlockedDecorations,
    wearing: user.decoration,
    faceUnlocked: !!customAvatarIsUnlocked,
    hasDrawnFace: user.avatarUrl !== '',
    event: event ? { slug: event.slug, name: event.name } : null,
    friendCount: profile?.friends.length ?? 0,
    seen,
    now: new Date(),
  });
  if (tips.length === 0) return null;

  const markSeen = (id: string) => () =>
    setSeen((ids) => (ids.includes(id) ? ids : [...ids, id]));

  return (
    <section
      aria-label="Things to try"
      className="flex flex-col gap-1.5 w-full"
    >
      <h2 className="text-pencil">try something new</h2>
      <ul className="flex gap-3 -mx-5 px-5 pt-3 pb-2 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]">
        {tips.map((tip, index) => (
          <TipCard
            key={tip.id}
            index={index}
            {...viewOf(tip, user)}
            onSeen={markSeen(tip.id)}
          />
        ))}
      </ul>
    </section>
  );
};
