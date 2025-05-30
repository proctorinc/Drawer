import React, { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { faSpinner, faUserFriends } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UserProfileIcon } from './profile/components/UserProfileIcon';
import { useAddFriend, useUser } from '@/api/Api';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { nameToColor } from '@/utils';
import { Card, CardContent } from '@/components/Card';

const AddFriendPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams({ from: '/app/add-friend/$userId' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: user, isLoading, error: userError } = useUser(userId);
  const addFriendMutation = useAddFriend();
  const { secondary } = nameToColor(user?.username ?? '');

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    addFriendMutation
      .mutateAsync(userId)
      .then(() => {
        setSuccess('Friend added successfully!');
        navigate({ to: '/app/user-profile' });
      })
      .catch(() => setError('Error adding friend'));
  };

  return (
    <Layout>
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <Card>
          <form onSubmit={handleAddFriend}>
            <CardContent>
              {error && (
                <p className="text-center text-sm font-bold text-red-700">
                  {error}
                </p>
              )}
              {success && <p className="text-green-500">{success}</p>}
              {!isLoading && user && (
                <>
                  <div className="flex flex-col gap-2">
                    <div
                      className="flex items-center gap-2 rounded-2xl w-full px-4 py-2"
                      style={{ backgroundColor: secondary }}
                    >
                      <UserProfileIcon user={user} />
                      <h3 className="text-primary text-lg font-bold">
                        {user.username}
                      </h3>
                    </div>
                    <p className="text-center font-bold">
                      Invited you to be their friend
                    </p>
                  </div>

                  <Button
                    type="submit"
                    icon={faUserFriends}
                    disabled={addFriendMutation.isPending}
                  >
                    Add Friend
                  </Button>
                </>
              )}
              {isLoading && (
                <div className="flex items-center justify-center w-full h-40">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    size="3x"
                    className="h-12 w-12 animate-spin"
                  />
                </div>
              )}
              {!isLoading && !user && (
                <p className="text-center text-sm font-bold text-red-700">
                  {userError
                    ? "Invalid invitation link. User doesn't exist"
                    : ''}
                </p>
              )}
            </CardContent>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default AddFriendPage;
