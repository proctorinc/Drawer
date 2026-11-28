import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMyProfilePage } from '../context/MyProfileContext';
import { useFlair } from '../useFlair';
import { BasicProfileIcon } from './profile-icons/BasicProfileIcon';
import { CustomProfileIcon } from './profile-icons/CustomProfileIcon';
import { UserProfileIcon } from './profile-icons/UserProfileIcon';
import type { FC, FormEvent, ReactNode } from 'react';
import type { DecorationId } from '@/api/Api';
import {
  MAX_AVATAR_SLOTS,
  queryKeys,
  useUpdateColor,
  useUpdateDecoration,
  useUpdateUsername,
} from '@/api/Api';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { CheckIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { AvatarDecoration, DECORATIONS } from '@/decorations/decorations';
import { useChristmas } from '@/events/useChristmas';
import { PROFILE_HUES, cn, dabShapes, hueToColor, nameToHue } from '@/utils';

// Avatars inside a swatch would otherwise open your profile when tapped
const ignoreClick = () => {};

type SwatchProps = {
  label: string;
  isSelected?: boolean;
  /** Not earned yet: still tappable, so it can say how to earn it */
  isLocked?: boolean;
  /** An empty spot waiting to be filled */
  isDashed?: boolean;
  /** A little marker in the corner, like a pencil while picking one to redraw */
  badge?: ReactNode;
  onClick: () => void;
  children: ReactNode;
};

/** A small tile to pick, showing what you'd look like */
const Swatch: FC<SwatchProps> = ({
  label,
  isSelected,
  isLocked,
  isDashed,
  badge,
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
      isSelected ? 'bg-me border-ink shadow-pencil-sm' : 'bg-white border-line',
      (isLocked || isDashed) && 'border-dashed',
      isDashed && 'border-ink bg-transparent',
    )}
  >
    <span className={cn('flex', isLocked && 'opacity-60')}>{children}</span>
    {(isLocked || badge) && (
      <span className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full bg-ink text-white text-[10px]">
        {isLocked ? <FontAwesomeIcon icon={faLock} /> : badge}
      </span>
    )}
  </button>
);

type SectionProps = {
  /** One line under the section: what's picked, how to unlock, or an error */
  note?: ReactNode;
  children: ReactNode;
};

const Section: FC<SectionProps> = ({ note, children }) => (
  <section className="flex flex-col gap-2">
    {children}
    {note && <p className="text-sm text-pencil">{note}</p>}
  </section>
);

const FacePicker = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { customAvatarIsUnlocked, toggleAvatar, avatars, wearAvatar } =
    useMyProfilePage();
  const [note, setNote] = useState<string>();
  // With every slot full, a new face has to replace one: this is that choice
  const [pickingRedraw, setPickingRedraw] = useState(false);
  const faces = avatars ?? [];
  const isFull = faces.length >= MAX_AVATAR_SLOTS;
  const isWearing = (url: string) =>
    user.avatarType === 'custom' && user.avatarUrl === url;

  const drawFace = (slot: number) =>
    navigate({ to: '/draw/profile/pic', search: { slot } });

  function addFace() {
    const taken = new Set(faces.map((f) => f.slot));
    const slot = Array.from({ length: MAX_AVATAR_SLOTS }, (_, i) => i).find(
      (i) => !taken.has(i),
    );
    if (slot !== undefined) drawFace(slot);
  }

  function chooseFace(slot: number, url: string) {
    if (pickingRedraw) {
      drawFace(slot);
    } else if (!isWearing(url)) {
      wearAvatar(slot);
    }
  }

  function togglePicking() {
    setPickingRedraw(!pickingRedraw);
    setNote(
      pickingRedraw
        ? undefined
        : 'pick a face to redraw. it gets replaced when you save',
    );
  }

  return (
    <Section note={note}>
      <div className="flex flex-wrap gap-2">
        <Swatch
          label="initials"
          isSelected={!pickingRedraw && user.avatarType === 'basic'}
          onClick={() => {
            if (pickingRedraw) return;
            if (user.avatarType === 'custom') toggleAvatar();
          }}
        >
          <BasicProfileIcon user={user} size="lg" onClick={ignoreClick} />
        </Swatch>
        {!customAvatarIsUnlocked ? (
          <Swatch
            label="draw my face"
            isLocked
            onClick={() =>
              setNote('keep a 7 day streak to draw your own face')
            }
          >
            <span className="flex items-center justify-center size-12 border-2 border-dashed border-ink rounded-full">
              <PencilIcon size={22} />
            </span>
          </Swatch>
        ) : (
          <>
            {faces.map((face) => (
              <Swatch
                key={face.slot}
                label={
                  pickingRedraw
                    ? `redraw face ${face.slot + 1}`
                    : `wear face ${face.slot + 1}`
                }
                isSelected={!pickingRedraw && isWearing(face.url)}
                badge={pickingRedraw && <PencilIcon size={12} />}
                onClick={() => chooseFace(face.slot, face.url)}
              >
                <CustomProfileIcon
                  user={{ ...user, avatarUrl: face.url }}
                  size="lg"
                  onClick={ignoreClick}
                />
              </Swatch>
            ))}
            {!isFull && (
              <Swatch
                label={faces.length ? 'draw another face' : 'draw my face'}
                isDashed
                onClick={addFace}
              >
                <PlusIcon size={24} />
              </Swatch>
            )}
            {isFull && (
              <Swatch
                label={pickingRedraw ? 'cancel redraw' : 'redraw a face'}
                isSelected={pickingRedraw}
                onClick={togglePicking}
              >
                <span className="flex flex-col items-center text-sm leading-tight">
                  <PencilIcon size={20} />
                  {pickingRedraw ? 'cancel' : 'redraw'}
                </span>
              </Swatch>
            )}
          </>
        )}
      </div>
    </Section>
  );
};

/** Room around the drawing, in its own units, so the ink outline isn't cut off */
const ART_PADDING = 4;

/**
 * A decoration by itself, zoomed in to fill its box. Each one is drawn to sit
 * somewhere around a face (a hat above it, wings beside it), so this measures
 * what's actually drawn and points the picture's viewBox at just that.
 */
const DecorationArt: FC<{ id: DecorationId }> = ({ id }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState(false);

  useLayoutEffect(() => {
    const box = ref.current;
    const svg = box?.querySelector('svg');
    if (!box || !svg) return;

    /** Fits the picture to what's drawn; false while it isn't laid out yet */
    const fit = () => {
      const { x, y, width, height } = svg.getBBox();
      if (!width || !height) return false;
      const side = Math.max(width, height) + ART_PADDING * 2;
      const left = x + width / 2 - side / 2;
      const top = y + height / 2 - side / 2;
      svg.setAttribute('viewBox', `${left} ${top} ${side} ${side}`);
      // Drop whatever placement it has over an avatar and fill the box instead
      Object.assign(svg.style, {
        inset: '0',
        width: '100%',
        height: '100%',
        transform: 'none',
      });
      setFitted(true);
      return true;
    };

    if (fit()) return;
    // Inside a sheet that hasn't opened yet nothing measures, so fit once it shows
    const observer = new ResizeObserver(() => fit() && observer.disconnect());
    observer.observe(box);
    return () => observer.disconnect();
  }, [id]);

  return (
    <span
      ref={ref}
      className={cn('relative block size-16', !fitted && 'invisible')}
    >
      <AvatarDecoration id={id} />
    </span>
  );
};

/** The flair you've earned, newest first; tapping one puts it on */
const FlairPicker: FC<{ tryOn?: string }> = ({ tryOn }) => {
  const user = useUser();
  const { reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const christmas = useChristmas();
  const { isUnlocked, recent, isLoading } = useFlair();
  const updateDecoration = useUpdateDecoration();
  const [error, setError] = useState<string | null>(null);

  /** Wears a decoration, or nothing with '' */
  function wear(decoration: DecorationId | '') {
    setError(null);
    if (decoration === user.decoration || updateDecoration.isPending) return;
    updateDecoration
      .mutateAsync(decoration)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        reloadUser();
      })
      .catch((err) => setError(err.message));
  }

  // Arriving from a flair link puts that one on
  const triedOn = useRef(false);
  useEffect(() => {
    if (triedOn.current || isLoading || !tryOn || !(tryOn in DECORATIONS))
      return;
    triedOn.current = true;
    if (isUnlocked(tryOn as DecorationId)) wear(tryOn as DecorationId);
  }, [isLoading, tryOn]);

  function note() {
    if (error) return error;
    if (user.decoration && user.decoration in DECORATIONS) {
      return `wearing ${DECORATIONS[user.decoration].name}`;
    }
    return christmas
      ? "wearing nothing, so you get everyone's santa hat this season"
      : 'wearing nothing';
  }

  return (
    <Section note={note()}>
      <ul className="grid grid-cols-3 gap-2">
        <li>
          <FlairTile
            label="nothing"
            isSelected={!user.decoration}
            onClick={() => wear('')}
          >
            <span className="grid place-items-center size-16">
              <span className="size-12 border-2 border-dashed border-line rounded-full" />
            </span>
          </FlairTile>
        </li>
        {recent.map((id) => (
          <li key={id}>
            <FlairTile
              label={DECORATIONS[id].name}
              isSelected={user.decoration === id}
              onClick={() => wear(id)}
            >
              <DecorationArt id={id} />
            </FlairTile>
          </li>
        ))}
      </ul>
      <Link
        to="/draw/profile/me/decorations"
        className="self-start text-sm text-pencil underline underline-offset-2"
      >
        {recent.length
          ? 'see what else you can earn'
          : 'no flair yet. see how to earn some'}
      </Link>
    </Section>
  );
};

type FlairTileProps = {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
};

const FlairTile: FC<FlairTileProps> = ({
  label,
  isSelected,
  onClick,
  children,
}) => (
  <button
    type="button"
    aria-pressed={isSelected}
    onClick={onClick}
    className={cn(
      'press flex flex-col items-center gap-2 w-full h-full p-2 pb-2.5 border-2 rounded-sketch-alt cursor-pointer',
      isSelected ? 'bg-me border-ink shadow-pencil-sm' : 'bg-white border-line',
    )}
  >
    {children}
    <span className="text-sm leading-tight text-center">{label}</span>
  </button>
);

/** Your profile color: your name's own, or one from the palette */
const ColorPicker = () => {
  const user = useUser();
  const { reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const updateColor = useUpdateColor();
  const [error, setError] = useState<string | null>(null);
  const nameHue = nameToHue(user.username);

  function pick(colorHue: number | null) {
    setError(null);
    if (colorHue === (user.colorHue ?? null) || updateColor.isPending) return;
    updateColor
      .mutateAsync(colorHue)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
        reloadUser();
      })
      .catch((err) => setError(err.message));
  }

  const choices: Array<{ hue: number | null; label: string }> = [
    { hue: null, label: "my name's color" },
    ...PROFILE_HUES.map((hue, i) => ({ hue, label: `color ${i + 1}` })),
  ];

  return (
    <Section
      note={
        error ??
        (user.colorHue === undefined
          ? 'using the color your name gives you'
          : 'the first one goes back to the color your name gives you')
      }
    >
      <ul className="grid grid-cols-5 gap-2.5">
        {choices.map(({ hue, label }, i) => {
          const isSelected = hue === (user.colorHue ?? null);
          const { primary, text } = hueToColor(hue ?? nameHue);
          return (
            <li key={label} className="flex">
              <button
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => pick(hue)}
                style={{ backgroundColor: primary, color: text }}
                className={cn(
                  'press grid place-items-center w-full aspect-square border-2 border-ink cursor-pointer font-accent font-bold text-lg',
                  dabShapes[i % dabShapes.length],
                  isSelected && 'border-[3.5px] shadow-pencil-sm -rotate-3',
                )}
              >
                {hue === null
                  ? 'Aa'
                  : isSelected && <CheckIcon size={22} strokeWidth={3} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};

/** Changing your name: on its own, from the settings gear */
export const NameForm = () => {
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
        setMessage(
          user.colorHue === undefined ? 'saved! new name, new color' : 'saved!',
        );
      })
      .catch((err) => setMessage(err.message));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="username" className="sr-only">
        my name
      </label>
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
      <p className="text-sm text-pencil">
        {message ?? 'no spaces, 15 letters max'}
      </p>
    </form>
  );
};

type EditTab = 'flair' | 'color' | 'face';

const TABS: Array<{ id: EditTab; label: string }> = [
  { id: 'flair', label: 'flair' },
  { id: 'color', label: 'color' },
  { id: 'face', label: 'face' },
];

/**
 * Your face, flair and color. You, big, stay pinned at the top while you pick,
 * so every tap shows on you straight away
 */
const EditProfile: FC<{ tryOn?: string }> = ({ tryOn }) => {
  const user = useUser();
  const [tab, setTab] = useState<EditTab>('flair');

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col items-center gap-4 -mx-6 px-6 pt-11 pb-3 bg-paper border-b-2 border-dashed border-line">
        <UserProfileIcon
          user={user}
          size="2xl"
          decorationPreview
          showLevel={false}
          onClick={ignoreClick}
        />
        <div role="tablist" aria-label="What to change" className="flex gap-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === tab}
              onClick={() => setTab(id)}
              className={cn(
                'h-9 px-4 border-2 border-ink rounded-[14px_10px_14px_12px] font-accent font-bold text-lg leading-none cursor-pointer transition-colors',
                id === tab ? 'bg-ink text-white' : 'bg-white hover:bg-me',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === 'face' && <FacePicker />}
        {tab === 'flair' && <FlairPicker tryOn={tryOn} />}
        {tab === 'color' && <ColorPicker />}
      </div>
    </>
  );
};

export default EditProfile;
