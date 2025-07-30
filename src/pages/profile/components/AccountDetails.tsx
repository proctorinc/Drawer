import {
  faCancel,
  faCheckCircle,
  faCircleCheck,
  faCrown,
  faDoorOpen,
  faEdit,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { useState, type FormEvent } from 'react';
import { queryKeys, useUpdateUsername } from '@/api/Api';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import { useNavigate } from '@tanstack/react-router';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import NotificationSettings from './NotificationSettings';
import { useMyProfilePage } from '../context/MyProfileContext';
import { cn } from '@/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CustomProfileIcon } from './profile-icons/CustomProfileIcon';
import { BasicProfileIcon } from './profile-icons/BasicProfileIcon';

const AccountDetails = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { customAvatarIsUnlocked, toggleAvatar } = useMyProfilePage();
  const { logout, reloadUser } = useAuth();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const updateUsernameMutation = useUpdateUsername();
  const queryClient = useQueryClient();

  function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    updateUsernameMutation
      .mutateAsync(username, {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.myProfile,
          });
          setIsEditingUsername(false);
        },
      })
      .then(() => {
        reloadUser();
      })
      .catch((err) => {
        setError(err.message);
      });
  }

  function handleToggleEditUsername() {
    setIsEditingUsername((prev) => {
      if (prev) {
        setUsername('');
      }

      return !prev;
    });
  }

  return (
    <>
      <Card>
        <CardContent className="font-bold text-primary">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <UserProfileIcon size="sm" user={user} />
                <h3 className="text-lg font-bold text-primary">Account</h3>
              </div>
            }
          >
            <Button size="sm" icon={faDoorOpen} onClick={logout}>
              Log out
            </Button>
          </CardHeader>
          <div className="flex flex-col gap-2 bg-base p-4 rounded-2xl text-sm">
            <div className="flex gap-2">
              <label className="text-primary-foreground font-bold">
                Username:
              </label>
              <p className="text-primary/80 font-semibold">{user.username}</p>
            </div>
            <div className="flex gap-2">
              <label className="text-primary-foreground font-bold">
                Email:
              </label>
              <p className="text-primary/80 font-semibold">{user.email}</p>
            </div>
            <div className="flex gap-2">
              <label className="text-primary-foreground font-bold">
                Member since:
              </label>
              <p className="text-primary/80 font-semibold">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {user.username === 'matty_p' && (
        <Card>
          <CardContent className="font-bold text-primary">
            <CardHeader title="Admin"></CardHeader>
            <Button
              icon={faCrown}
              onClick={() => navigate({ to: '/draw/admin' })}
            >
              View Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="font-bold text-primary">
          <CardHeader
            title="Profile Picture"
            subtitle="Select your style"
          ></CardHeader>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant={user.avatarType === 'basic' ? 'primary' : 'base'}
              className="relative flex justify-start"
              disableLoad
              onClick={
                user.avatarType === 'basic' || !customAvatarIsUnlocked
                  ? undefined
                  : toggleAvatar
              }
            >
              <BasicProfileIcon size="sm" user={user} /> Basic
              {user.avatarType === 'basic' && (
                <FontAwesomeIcon
                  className="absolute right-4 text-lg text-primary"
                  icon={faCheckCircle}
                />
              )}
            </Button>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 w-full">
                <Button
                  size="sm"
                  variant={user.avatarType === 'custom' ? 'primary' : 'base'}
                  disableLoad
                  disabled={!customAvatarIsUnlocked}
                  className={cn(
                    'relative flex justify-start w-full',
                    !customAvatarIsUnlocked && 'bg-red-500',
                  )}
                  onClick={() => {
                    if (user.avatarType === 'basic' && user.avatarUrl === '') {
                      navigate({ to: '/draw/profile/pic' });
                    } else if (user.avatarType === 'basic') {
                      toggleAvatar();
                    }
                  }}
                >
                  <CustomProfileIcon size="sm" user={user} />
                  Custom
                  {!customAvatarIsUnlocked && <FontAwesomeIcon icon={faLock} />}
                  {user.avatarType === 'custom' && (
                    <FontAwesomeIcon
                      className="absolute right-4 text-lg text-primary"
                      icon={faCheckCircle}
                    />
                  )}
                </Button>
                {customAvatarIsUnlocked &&
                  user.avatarType === 'custom' &&
                  user.avatarUrl !== '' && (
                    <Button
                      className="w-1/4 text-sm"
                      icon={faEdit}
                      onClick={() => navigate({ to: '/draw/profile/pic' })}
                    ></Button>
                  )}
              </div>
              {!customAvatarIsUnlocked && (
                <span className="text-center text-xs text-secondary">
                  Get a 14 day doodle streak to unlock
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CardHeader
            title="Change Username"
            subtitle={
              isEditingUsername
                ? 'No spaces allowed, max length 15'
                : 'New username, new profile colors'
            }
          >
            <Button
              size="sm"
              icon={isEditingUsername ? faCancel : faEdit}
              onClick={handleToggleEditUsername}
              disableLoad
            ></Button>
          </CardHeader>

          {isEditingUsername && (
            <form
              onSubmit={handleUpdateProfile}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 rounded-2xl">
                <input
                  id="username"
                  type="text"
                  placeholder={user.username}
                  className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                />
                <Button
                  type="submit"
                  disabled={
                    username === user.username ||
                    updateUsernameMutation.isPending
                  }
                  icon={faCircleCheck}
                  className="disabled:bg-base"
                ></Button>
              </div>
              {error && (
                <p className="text-center text-sm font-bold text-red-700">
                  {error}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
      {user.username === 'matty_p' && <NotificationSettings />}
    </>
  );
};

export default AccountDetails;
