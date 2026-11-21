import { Link } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import { FriendsIcon, PencilIcon, StarIcon } from '@/components/icons';
import { cn } from '@/utils';
import { bookPage } from '@/pages/profile/useBookOwner';

const stickerClass =
  'press relative flex flex-col items-center flex-1 min-w-0 py-2 border-2 border-ink rounded-sketch shadow-pencil-sm cursor-pointer hover:rotate-0';

const Face: FC<{ icon: ReactNode; value?: number; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <>
    <span className="flex items-center gap-1 font-accent font-bold text-[28px] leading-none">
      {icon}
      {value ?? '–'}
    </span>
    <span className="text-sm text-pencil">{label}</span>
  </>
);

type Props = {
  /** 'me' for your own book, otherwise their id */
  userId: string;
  friends: number;
  drawings: number;
  /** Undefined while their stickers load */
  stickers?: number;
  onFriendsClick: () => void;
  /** Pending friend requests, shown as a red dot on the friends sticker */
  friendRequests?: number;
};

/** Three stickers under the cover, each one opening the whole list */
const ProfileStats: FC<Props> = ({
  userId,
  friends,
  drawings,
  stickers,
  onFriendsClick,
  friendRequests = 0,
}) => (
  <div className="flex gap-3 w-full">
    <button
      onClick={onFriendsClick}
      className={cn(stickerClass, 'bg-blush -rotate-2')}
    >
      <Face
        icon={<FriendsIcon size={22} />}
        value={friends}
        label={friends === 1 ? 'friend' : 'friends'}
      />
      {friendRequests > 0 && (
        <span
          aria-label={`${friendRequests} new requests`}
          className="absolute -top-2.5 -right-2 flex items-center justify-center min-w-6 h-6 px-1.5 bg-coral text-ink border-2 border-ink rounded-full text-sm font-bold animate-nudge"
        >
          {friendRequests}
        </span>
      )}
    </button>
    <Link
      {...bookPage(userId, 'drawings')}
      className={cn(stickerClass, 'bg-sky rotate-1')}
    >
      <Face
        icon={<PencilIcon size={22} />}
        value={drawings}
        label={drawings === 1 ? 'drawing' : 'drawings'}
      />
    </Link>
    <Link
      {...bookPage(userId, 'stickers')}
      className={cn(stickerClass, 'bg-me -rotate-1')}
    >
      <Face
        icon={<StarIcon size={22} fill="white" />}
        value={stickers}
        label={stickers === 1 ? 'sticker' : 'stickers'}
      />
    </Link>
  </div>
);

export default ProfileStats;
