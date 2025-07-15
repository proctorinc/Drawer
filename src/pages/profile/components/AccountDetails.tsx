import { faCircleCheck, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { useState, type FormEvent } from 'react';
import { queryKeys, useUpdateUsername } from '@/api/Api';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';

const AccountDetails = () => {
  const user = useUser();
  const { logout, reloadUser } = useAuth();
  const [username, setUsername] = useState(user.username || '');
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
        },
      })
      .then(() => {
        reloadUser();
      })
      .catch((err) => {
        setError(err.message);
      });
  }

  return (
    <Card>
      <CardContent>
        <CardHeader title="Account" subtitle="Change username">
          <Button size="sm" variant="base" icon={faDoorOpen} onClick={logout}>
            Log out
          </Button>
        </CardHeader>
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-2">
          <div className="flex gap-2 rounded-2xl">
            <input
              id="username"
              type="text"
              placeholder="Username"
              className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
            />
            <Button
              type="submit"
              disabled={
                username === user.username || updateUsernameMutation.isPending
              }
              icon={faCircleCheck}
              className="disabled:bg-base"
            ></Button>
          </div>{' '}
          {error && (
            <p className="text-center text-sm font-bold text-red-700">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default AccountDetails;
