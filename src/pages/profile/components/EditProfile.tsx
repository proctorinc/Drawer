import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMyProfilePage } from '../context/MyProfileContext';
import { BasicProfileIcon } from './profile-icons/BasicProfileIcon';
import { CustomProfileIcon } from './profile-icons/CustomProfileIcon';
import { UserProfileIcon } from './profile-icons/UserProfileIcon';
import type { FC, FormEvent, ReactNode } from 'react';
import type { DecorationId } from '@/api/Api';
import { queryKeys, useUpdateDecoration, useUpdateUsername } from '@/api/Api';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { PencilIcon } from '@/components/icons';
import { DECORATIONS, DECORATION_GROUPS } from '@/decorations/decorations';
import { useChristmas } from '@/events/useChristmas';
import { cn } from '@/utils';

// Avatars inside a swatch would otherwise open your profile when tapped
const ignoreClick = () => {};

type SwatchProps = {
  label: string;
  isSelected?: boolean;
  /** Not earned yet: still tappable, so it can say how to earn it */
  isLocked?: boolean;
  onClick: () => void;
  children: ReactNode;
};

/** A small tile to pick, showing what you'd look like */
const Swatch: FC<SwatchProps> = ({
  label,
  isSelected,
  isLocked,
  onClick,
  children,
}) => (
  <button
    type="button"
    aria-label={isLocked ? `${label} (locked)` : label}
    aria-pressed={isSelected}
    onClick={onClick}
    className={cn(
      'press relative flex items-center justify-center size-[68px] border-2 rounded-sketch-alt cursor-pointer',
      isSelected
        ? 'bg-butter border-ink shadow-pencil-sm'
        : 'bg-white border-line',
      isLocked && 'border-dashed',
    )}
  >
    <span className={cn('flex', isLocked && 'opacity-60')}>{children}</span>
    {isLocked && (
      <span className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full bg-ink text-white text-[10px]">
        <FontAwesomeIcon icon={faLock} />
      </span>
    )}
  </button>
);

type SectionProps = {
  /** Lets a link scroll straight to the section, e.g. #decorations */
  id?: string;
  title: ReactNode;
  /** One line under the section: what's picked, how to unlock, or an error */
  note?: string;
  children: ReactNode;
};

const Section: FC<SectionProps> = ({ id, title, note, children }) => (
  <section id={id} className="flex flex-col gap-2 scroll-mt-4">
    <h3 className="font-accent font-bold text-xl leading-none">{title}</h3>
    {children}
    {note && <p className="text-sm text-pencil">{note}</p>}
  </section>
);

const FacePicker = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { customAvatarIsUnlocked, toggleAvatar } = useMyProfilePage();
  const [note, setNote] = useState<string>();
  const hasDrawnAvatar = user.avatarUrl !== '';
  const drawFace = () => navigate({ to: '/draw/profile/pic' });

  function chooseDrawing() {
    if (!customAvatarIsUnlocked) {
      setNote('keep a 14 day streak to draw your own face');
    } else if (!hasDrawnAvatar) {
      drawFace();
    } else if (user.avatarType === 'basic') {
      toggleAvatar();
    }
  }

  return (
    <Section title="my face" note={note}>
      <div className="flex flex-wrap gap-2">
        <Swatch
          label="initials"
          isSelected={user.avatarType === 'basic'}
          onClick={() => user.avatarType === 'custom' && toggleAvatar()}
        >
          <BasicProfileIcon user={user} size="lg" onClick={ignoreClick} />
        </Swatch>
        <Swatch
          label={hasDrawnAvatar ? 'my drawing' : 'draw my face'}
          isSelected={user.avatarType === 'custom'}
          isLocked={!customAvatarIsUnlocked}
          onClick={chooseDrawing}
        >
          {hasDrawnAvatar ? (
            <CustomProfileIcon user={user} size="lg" onClick={ignoreClick} />
          ) : (
            <span className="flex items-center justify-center size-12 border-2 border-dashed border-ink rounded-full">
              <PencilIcon size={22} />
            </span>
          )}
        </Swatch>
        {customAvatarIsUnlocked && hasDrawnAvatar && (
          <Swatch label="redraw my face" onClick={drawFace}>
            <span className="flex flex-col items-center text-sm leading-tight">
              <PencilIcon size={20} />
              redraw
            </span>
          </Swatch>
        )}
      </div>
    </Section>
  );
};

type FlairGroupProps = { name: string; children: ReactNode };

/** A labeled cluster of tiles; clusters sit side by side while they fit */
const FlairGroup: FC<FlairGroupProps> = ({ name, children }) => (
  <div className="flex flex-col gap-1.5">
    <h4 className="text-sm text-pencil leading-none">{name}</h4>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

/** One decoration to wear on your face, grouped by what unlocks them */
const FlairPicker = () => {
  const user = useUser();
  const { reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const christmas = useChristmas();
  const { achievementsData } = useMyProfilePage();
  const updateDecoration = useUpdateDecoration();
  const [peeking, setPeeking] = useState<DecorationId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUnlocked = (id: DecorationId) => !!achievementsData?.rewards.has(id);
  const stickerFor = (id: DecorationId) =>
    achievementsData?.achievements.find((a) => a.reward?.id === id)?.name;

  /** Wears a decoration, or nothing with '' */
  function wear(decoration: DecorationId | '') {
    setPeeking(decoration || null);
    setError(null);
    const locked = decoration !== '' && !isUnlocked(decoration);
    if (locked || decoration === user.decoration || updateDecoration.isPending)
      return;
    updateDecoration
      .mutateAsync(decoration)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        reloadUser();
      })
      .catch((err) => setError(err.message));
  }

  function note() {
    if (error) return error;
    if (peeking && !isUnlocked(peeking)) {
      const sticker = stickerFor(peeking);
      return `${DECORATIONS[peeking].name}: earn ${sticker ? `the ${sticker} sticker` : 'its sticker'} to wear it`;
    }
    if (user.decoration && user.decoration in DECORATIONS) {
      return `wearing ${DECORATIONS[user.decoration].name}`;
    }
    return christmas
      ? "wearing nothing, so you get everyone's santa hat this season"
      : 'wearing nothing. earn stickers to unlock flair';
  }

  return (
    <Section id="decorations" title="my flair" note={note()}>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        <FlairGroup name="free">
          <Swatch
            label="wear nothing"
            isSelected={!user.decoration}
            onClick={() => wear('')}
          >
            <UserProfileIcon
              user={{ ...user, decoration: '' }}
              size="lg"
              onClick={ignoreClick}
            />
          </Swatch>
        </FlairGroup>
        {DECORATION_GROUPS.map((group) => (
          <FlairGroup key={group.name} name={group.name}>
            {group.ids.map((id) => (
              <Swatch
                key={id}
                label={DECORATIONS[id].name}
                isSelected={user.decoration === id}
                isLocked={!isUnlocked(id)}
                onClick={() => wear(id)}
              >
                <UserProfileIcon
                  user={{ ...user, decoration: id }}
                  size="lg"
                  onClick={ignoreClick}
                />
              </Swatch>
            ))}
          </FlairGroup>
        ))}
      </div>
    </Section>
  );
};

const NameForm = () => {
  const user = useUser();
  const { reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const updateUsername = useUpdateUsername();
  const [username, setUsername] = useState(user.username);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    updateUsername
      .mutateAsync(username)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        reloadUser();
        setMessage('saved! new name, new colors');
      })
      .catch((err) => setMessage(err.message));
  }

  return (
    <form onSubmit={handleSubmit}>
      <Section
        title={<label htmlFor="username">my name</label>}
        note={message ?? 'no spaces, 15 letters max. your colors come from it'}
      >
        <div className="flex gap-2">
          <input
            id="username"
            type="text"
            maxLength={15}
            autoComplete="off"
            className="w-full h-10 px-3 bg-white border-2 border-ink rounded-sketch-alt text-lg focus:outline-none focus:-rotate-1 transition-[rotate] duration-300"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))
            }
            required
          />
          <Button
            type="submit"
            size="sm"
            disableLoad
            disabled={username === user.username || updateUsername.isPending}
          >
            save
          </Button>
        </div>
      </Section>
    </form>
  );
};

/** Your face, your flair and your name, the things friends see first */
const EditProfile = () => (
  <>
    <FacePicker />
    <FlairPicker />
    <NameForm />
  </>
);

export default EditProfile;
