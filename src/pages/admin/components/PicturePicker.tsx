import { useState } from 'react';
import { useAdminUserAvatars, useSetUserPicture } from '../api';
import type { AdminUser, PictureChoice } from '../api';
import type { FC, ReactNode } from 'react';
import type {
  AvatarLook,
  AvatarParts,
} from '@/pages/profile/components/profile-icons/sketchFace';
import Button from '@/components/Button';
import { cn } from '@/utils';
import { DefaultAvatar } from '@/pages/profile/components/profile-icons/DefaultAvatar';
import { useSketchFace } from '@/pages/profile/components/profile-icons/avatarFaces';
import {
  EXTRAS,
  GLASSES,
  HAIR,
  NECKLINES,
  faceKey,
} from '@/pages/profile/components/profile-icons/sketchFace';

const LOOKS: Array<AvatarLook> = ['neutral', 'fem', 'masc'];

/** A round button showing one choice, ringed when it's the one picked */
const Choice: FC<{
  label: string;
  picked: boolean;
  onClick: () => void;
  children: ReactNode;
}> = ({ label, picked, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={picked}
    onClick={onClick}
    className={cn(
      'press size-12 flex-none overflow-hidden rounded-full border-2 border-ink cursor-pointer',
      picked && 'ring-4 ring-butter',
    )}
  >
    {children}
  </button>
);

const Row: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-sm text-pencil">{title}</span>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

/**
 * Swaps a player's profile picture: one of the faces they drew, or a sketch
 * face built part by part, or back to the sketch face their id gives them
 */
const PicturePicker: FC<{ user: AdminUser; onDone: () => void }> = ({
  user,
  onDone,
}) => {
  const worn = useSketchFace(user);
  const [draft, setDraft] = useState<AvatarParts>(worn);
  const drawn = useAdminUserAvatars(user.id);
  const setPicture = useSetUserPicture(user.id);
  const choose = (choice: PictureChoice) =>
    setPicture.mutate(choice, { onSuccess: onDone });

  // A look has its own hair and extras, so switching keeps what still fits
  const pickLook = (look: AvatarLook) =>
    setDraft((d) => ({
      ...d,
      look,
      hair: HAIR[look].find((h) => h === d.hair) ?? HAIR[look][0],
      extra: EXTRAS[look].find((e) => e === d.extra) ?? 'none',
    }));
  const preview = (parts: Partial<AvatarParts>) => (
    <DefaultAvatar user={user} size="lg" parts={{ ...draft, ...parts }} />
  );
  const wearingSketch = user.avatarType !== 'custom';
  const slots = drawn.data ?? [];
  // Older drawn faces never got a slot; the one they wore is still on them
  const lastDrawn =
    !!user.avatarUrl && !slots.some((avatar) => avatar.url === user.avatarUrl);

  return (
    <div className="flex flex-col gap-5">
      {(lastDrawn || !!slots.length) && (
        <Row title="faces they drew">
          {lastDrawn && (
            <Choice
              label="the drawn face they last wore"
              picked={!wearingSketch}
              onClick={() => choose({ drawn: true })}
            >
              <img src={user.avatarUrl} alt="" className="size-full" />
            </Choice>
          )}
          {slots.map((avatar) => (
            <Choice
              key={avatar.slot}
              label={`drawn face ${avatar.slot + 1}`}
              picked={!wearingSketch && user.avatarUrl === avatar.url}
              onClick={() => choose({ slot: avatar.slot })}
            >
              <img src={avatar.url} alt="" className="size-full" />
            </Choice>
          ))}
        </Row>
      )}

      <div className="flex items-center gap-4">
        <div className="size-20 flex-none overflow-hidden rounded-full border-[2.5px] border-ink">
          <DefaultAvatar user={user} size="xl" parts={draft} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LOOKS.map((look) => (
            <button
              key={look}
              type="button"
              aria-pressed={draft.look === look}
              onClick={() => pickLook(look)}
              className={cn(
                'press px-3 py-1 border-2 border-ink rounded-sketch cursor-pointer',
                draft.look === look ? 'bg-butter' : 'bg-white',
              )}
            >
              {look}
            </button>
          ))}
        </div>
      </div>

      <Row title="hair">
        {HAIR[draft.look].map((hair) => (
          <Choice
            key={hair}
            label={hair}
            picked={draft.hair === hair}
            onClick={() => setDraft({ ...draft, hair })}
          >
            {preview({ hair })}
          </Choice>
        ))}
      </Row>
      <Row title="neckline">
        {NECKLINES.map((neckline) => (
          <Choice
            key={neckline}
            label={neckline}
            picked={draft.neckline === neckline}
            onClick={() => setDraft({ ...draft, neckline })}
          >
            {preview({ neckline })}
          </Choice>
        ))}
      </Row>
      <Row title="glasses">
        {GLASSES.map((glasses) => (
          <Choice
            key={glasses}
            label={`${glasses} glasses`}
            picked={draft.glasses === glasses}
            onClick={() => setDraft({ ...draft, glasses })}
          >
            {preview({ glasses })}
          </Choice>
        ))}
      </Row>
      {EXTRAS[draft.look].length > 1 && (
        <Row title="extra">
          {EXTRAS[draft.look].map((extra) => (
            <Choice
              key={extra}
              label={extra}
              picked={draft.extra === extra}
              onClick={() => setDraft({ ...draft, extra })}
            >
              {preview({ extra })}
            </Choice>
          ))}
        </Row>
      )}

      {setPicture.error && (
        <p className="text-coral">{setPicture.error.message}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={setPicture.isPending}
          onClick={() => choose({ face: faceKey(draft) })}
        >
          wear this face
        </Button>
        <Button
          variant="base"
          disabled={setPicture.isPending}
          onClick={() => choose({ face: '' })}
        >
          back to their own
        </Button>
      </div>
    </div>
  );
};

export default PicturePicker;
