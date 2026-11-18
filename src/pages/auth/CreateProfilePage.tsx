import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { SignUp } from '@clerk/react';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import useAuth from '@/auth/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

const CreateProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isSignedIn, isLoading, createUser } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate({ to: '/draw' });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createUser(username);
    } catch (err: any) {
      setError(err.message || 'Unable to create sign up');
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
          <SignUp
            routing="hash"
            signInUrl="/auth/login"
            fallbackRedirectUrl="/auth/sign-up"
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <h1 className="text-left text-xl font-bold text-primary">
          Pick a username
        </h1>
        <Card>
          <form onSubmit={handleSubmit}>
            <CardContent>
              {error && (
                <p className="text-center text-sm font-bold text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="username"
                  className="font-bold text-sm text-primary"
                >
                  Username
                </label>
                <div className="rounded-2xl">
                  <input
                    id="username"
                    type="text"
                    placeholder="Username"
                    className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={!username} icon={faArrowRight}>
                Join
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateProfilePage;
