import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMyProfilePage } from '../context/MyProfileContext';
import { BasicProfileIcon } from './profile-icons/BasicProfileIcon';
import { CustomProfileIcon } from './profile-icons/CustomProfileIcon';
import type { FC, FormEvent, ReactNode } from 'react';
import { queryKeys, useUpdateUsername } from '@/api/Api';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { PencilIcon } from '@/components/icons';
import { cn } from '@/utils';

type AvatarOptionProps = {
  label: string;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

const AvatarOption: FC<AvatarOptionProps> = ({
  label,
  isSelected,
  disabled,
  onClick,
  children,
}) => (
  <button
    aria-pressed={isSelected}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'press flex flex-col items-center gap-2 p-3 border-2 border-ink rounded-sketch-alt cursor-pointer disabled:cursor-default disabled:border-dashed disabled:opacity-70',
      isSelected ? 'bg-butter shadow-pencil-sm' : 'bg-white',
    )}
  >
    {children}
    <span className="flex items-center gap-1.5 text-lg">
      {disabled && <FontAwesomeIcon icon={faLock} />}
      {label}
    </span>
  </button>
);

const AvatarPicker = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { customAvatarIsUnlocked, toggleAvatar } = useMyProfilePage();
  const hasDrawnAvatar = user.avatarUrl !== '';

  function chooseCustom() {
    if (!hasDrawnAvatar) {
      navigate({ to: '/draw/profile/pic' });
    } else if (user.avatarType === 'basic') {
      toggleAvatar();
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-accent font-bold text-2xl leading-none">my face</h3>
      <div className="grid grid-cols-2 gap-3">
        <AvatarOption
          label="initials"
          isSelected={user.avatarType === 'basic'}
          onClick={() => user.avatarType === 'custom' && toggleAvatar()}
        >
          <BasicProfileIcon user={user} size="lg" />
        </AvatarOption>
        <AvatarOption
          label={hasDrawnAvatar ? 'my drawing' : 'draw one'}
          isSelected={user.avatarType === 'custom'}
          disabled={!customAvatarIsUnlocked}
          onClick={chooseCustom}
        >
          {hasDrawnAvatar ? (
            <CustomProfileIcon user={user} size="lg" />
          ) : (
            <span className="flex items-center justify-center size-12 border-2 border-dashed border-ink rounded-full">
              <PencilIcon size={22} />
            </span>
          )}
        </AvatarOption>
      </div>
      {!customAvatarIsUnlocked && (
        <p className="text-center text-pencil">
          keep a 14 day streak to unlock drawing your own face
        </p>
      )}
      {customAvatarIsUnlocked && hasDrawnAvatar && (
        <Button
          size="sm"
          variant="base"
          disableLoad
          className="self-center"
          onClick={() => navigate({ to: '/draw/profile/pic' })}
        >
          <PencilIcon size={18} />
          redraw my face
        </Button>
      )}
    </section>
  );
};

const UsernameForm = () => {
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label
        htmlFor="username"
        className="font-accent font-bold text-2xl leading-none"
      >
        my name
      </label>
      <div className="flex gap-2">
        <input
          id="username"
          type="text"
          maxLength={15}
          autoComplete="off"
          className="w-full h-11 px-3 bg-white border-2 border-ink rounded-sketch-alt text-lg focus:outline-none focus:-rotate-1 transition-[rotate] duration-300"
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
      <p className="text-pencil">
        {message ?? 'no spaces, 15 letters max. your colors come from it!'}
      </p>
    </form>
  );
};

/** Your face and your name, the two things friends see first */
const EditProfile = () => (
  <>
    <AvatarPicker />
    <UsernameForm />
  </>
);

export default EditProfile;
