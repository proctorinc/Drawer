import { Link } from '@tanstack/react-router';
import { pickTips } from '../tips';
import type { LinkProps } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import type { Tip } from '../tips';
import type { DecorationId } from '@/api/Api';
import { useGetAchievements } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { BellIcon, PencilIcon } from '@/components/icons';
import { DECORATIONS } from '@/decorations/decorations';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useNotifications } from '@/notifications/NotificationContext';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';
import { PIN_COLORS, PushPin } from '@/components/PushPin';

const IconArt: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="flex items-center justify-center size-12 bg-butter border-2 border-ink rounded-sketch-alt rotate-3">
    {children}
  </span>
);

type TipView = {
  art: ReactNode;
  title: ReactNode;
  action: string;
} & (
  | /** Where the action goes: the page, and the sheet or spot on it, via the hash */
  { to: LinkProps; onAction?: never }
  /** Or does the thing right here */
  | { to?: never; onAction: () => void }
);

/** What a tip looks like and what its button does */
function viewOf(
  tip: Tip,
  user: ReturnType<typeof useUser>,
  turnOnNotifications: () => void,
): TipView {
  switch (tip.kind) {
    case 'notifications':
      return {
        art: (
          <IconArt>
            <BellIcon size={24} />
          </IconArt>
        ),
        title: 'get a poke when the new prompt drops and friends react',
        action: 'turn on notifications',
        onAction: turnOnNotifications,
      };
    case 'flair':
      return {
        art: <UserProfileIcon user={{ ...user, decoration: tip.decoration }} />,
        title: 'you have flair to wear! try some on your face',
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
  /** Closing the card, or following its link, hides it for good */
  onSeen: () => void;
};

const actionClass =
  'press inline-flex items-center h-8 px-3 bg-ink text-paper border-2 border-ink rounded-sketch leading-none cursor-pointer';

/** A little pinned-up note with a picture, a line and a button that takes you there */
const TipCard: FC<CardProps> = ({
  index,
  art,
  title,
  action,
  to,
  onAction,
  onSeen,
}) => (
  <li
    className={cn(
      'relative flex-none flex gap-3 w-64 p-3 pt-4 bg-white shadow-[1px_2px_6px_rgba(43,42,51,0.18)] snap-start animate-drop',
      index % 2 ? 'rotate-1' : '-rotate-1',
    )}
    style={{ animationDelay: `${index * 90}ms` }}
  >
    <PushPin
      color={PIN_COLORS[index % PIN_COLORS.length]}
      lean={index % 2 === 0 ? 16 : -16}
      className="absolute z-10 -top-[23px] left-6"
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
      {to ? (
        <Link {...to} onClick={onSeen} className={actionClass}>
          {action}
        </Link>
      ) : (
        // Leaves the card up: it goes away by itself once this works
        <button onClick={onAction} className={actionClass}>
          {action}
        </button>
      )}
    </div>
  </li>
);

/** Little cards nudging you toward parts of the app you haven't used yet */
export const SuggestionCards = () => {
  const user = useUser();
  const { profile, customAvatarIsUnlocked } = useMyProfilePage();
  const { data: achievementsData } = useGetAchievements();
  const notifications = useNotifications();
  const [seen, setSeen] = useLocalStorage<Array<string>>(
    'HOME_TIPS_SEEN',
    [],
    0,
  );

  const unlockedDecorations = (
    Object.keys(DECORATIONS) as Array<DecorationId>
  ).filter((id) => achievementsData?.rewards.has(id));

  const tips = pickTips({
    canTurnOnNotifications:
      notifications.isSupported &&
      notifications.hasChecked &&
      !notifications.subscription &&
      !notifications.optedOut &&
      notifications.permission !== 'denied',
    unlockedDecorations,
    wearing: user.decoration,
    faceUnlocked: !!customAvatarIsUnlocked,
    hasDrawnFace: user.avatarUrl !== '',
    friendCount: profile?.friends.length ?? 0,
    seen,
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
            {...viewOf(tip, user, () => void notifications.subscribeToPush())}
            onSeen={markSeen(tip.id)}
          />
        ))}
      </ul>
    </section>
  );
};
