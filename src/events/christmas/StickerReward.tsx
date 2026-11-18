import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { StickerCount, StickerFace, stickerCard } from './StickerGoal';
import type { FC } from 'react';
import type { Achievement, DecorationId } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { DECORATIONS } from '@/decorations/decorations';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

// The preview avatar is a picture of you, not a link to your profile
const ignoreClick = () => {};

/**
 * A sticker by what it unlocks: a preview of you wearing its decoration.
 * Cards sit in a grid and share its rows (subgrid), so names and previews line
 * up across a row of cards.
 */
const StickerReward: FC<{ sticker: Achievement }> = ({ sticker }) => {
  const me = useUser();
  const earned = !!sticker.achievedAt;
  const { reward } = sticker;
  const decoration =
    reward && reward.id in DECORATIONS ? (reward.id as DecorationId) : null;

  return (
    <li className={cn(stickerCard(earned), 'row-span-3')}>
      <StickerCount sticker={sticker} />
      <StickerFace sticker={sticker} />

      {reward && (
        <span className="self-end text-[11px] leading-none uppercase tracking-wider text-pencil">
          {earned ? 'unlocked' : 'unlocks'}
        </span>
      )}

      {reward && (
        <span className="flex flex-col items-center gap-1.5">
          {decoration && (
            <span className="relative mt-2">
              <span
                className={cn('flex', !earned && 'opacity-75 grayscale-[30%]')}
              >
                <UserProfileIcon
                  user={{ ...me, decoration }}
                  size="lg"
                  onClick={ignoreClick}
                />
              </span>
              {!earned && (
                <span className="absolute -bottom-1 -right-1.5 flex items-center justify-center size-5 rounded-full bg-ink text-white text-[10px]">
                  <FontAwesomeIcon icon={faLock} />
                </span>
              )}
            </span>
          )}
          <span className="text-sm leading-tight">
            {reward.name.toLowerCase()}
          </span>
        </span>
      )}
    </li>
  );
};

export default StickerReward;
