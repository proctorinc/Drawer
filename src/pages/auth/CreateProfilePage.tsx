import {
  faArrowRight,
  faQuestionCircle,
  faThumbsUp,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { useProfile } from '@/pages/profile/UserProfileContext';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';

const CreateProfilePage: React.FC = () => {
  const { createUserProfile } = useProfile();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createUserProfile(username, email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isSubmitted) {
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
          <div className="bg-card border-2 border-border flex flex-col gap-4  rounded-2xl w-full max-w-md p-8 text-center">
            <h2 className="text-2xl font-bold text-primary">
              Check your email
            </h2>
            <p className="font-bold text-secondary">
              We've sent a verification link to {email}. Please check your inbox
              and click the link to verify your account.
            </p>
            <Button icon={faThumbsUp} onClick={() => setIsSubmitted(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <h1 className="text-left text-xl font-bold text-primary">
          Create Profile
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
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="email"
                  className="font-bold text-sm text-primary"
                >
                  Email
                </label>
                <div className=" rounded-2xl">
                  <input
                    id="email"
                    type="email"
                    placeholder="Email"
                    className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={!username || !email}
                icon={faArrowRight}
              >
                Join
              </Button>
            </CardContent>
          </form>
        </Card>
        <div className="flex gap-2 justify-center items-center  rounded-2xl border-2 border-border bg-border px-4 py-2 w-full max-w-md font-bold text-primary">
          <FontAwesomeIcon icon={faQuestionCircle} />
          <p className="text-sm">
            Already have an account?{' '}
            <Link
              to="/app/login"
              search={(currentSearch) => ({
                ...currentSearch,
              })}
              className="text-primary-foreground"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default CreateProfilePage;
