import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  faHome,
  faSpinner,
  faUserFriends,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UserProfileIcon } from './profile/components/UserProfileIcon';
import type { User } from '@/api/Api';
import { addFriend, fetchUserByID } from '@/api/Api';
import Layout from '@/components/Layout';
import Header from '@/components/Header';
import Button from '@/components/Button';
import { nameToColor } from '@/utils';

const AddFriendPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams({ from: '/app/add-friend/$userId' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { secondary } = nameToColor(user?.username ?? '');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await fetchUserByID(userId);
        setUser(userData);
      } catch (err) {
        setError("Invalid invitation link. User doesn't exist");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await addFriend(userId);
      setSuccess('Friend added successfully!');
      navigate({ to: '/app/user-profile' });
    } catch (err) {
      setError('Error adding friend');
    }
  };

  return (
    <Layout>
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <Header title="Add a friend!" subtitle="Daily Drawer">
          <HomeButton />
        </Header>
        <form
          onSubmit={handleAddFriend}
          className="flex flex-col gap-4 bg-card border-2 border-border rounded-2xl w-full max-w-md p-4"
        >
          {error && <p className="text-center text-red-500">{error}</p>}
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

              <Button type="submit" icon={faUserFriends}>
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
          {!isLoading && !user && <p className="text-center font-bold"></p>}
        </form>
      </div>
    </Layout>
  );
};

const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate({ to: '/app' })}
      className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-xl bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faHome} />
    </div>
  );
};

export default AddFriendPage;
