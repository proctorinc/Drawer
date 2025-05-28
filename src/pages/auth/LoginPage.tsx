import {
  faArrowRight,
  faQuestionCircle,
  faThumbsUp,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { Config } from '@/config/Config';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import Header from '@/components/Header';

const LoginPage: React.FC = () => {
  const { loginUserProfile } = useProfile();
  const [email, setEmail] = useState(
    Config.ENV !== 'production' ? 'demo1@example.com' : '',
  );
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await loginUserProfile(email);
      setIsSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
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
        <Header title="Login" subtitle="Welcome to Drawer"></Header>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 bg-card border-2 border-border rounded-2xl w-full max-w-md p-4"
        >
          {error && <p className="text-center text-red-500">{error}</p>}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="font-bold text-sm text-primary">
              Email
            </label>
            <div className=" rounded-2xl">
              <input
                type="email"
                placeholder="Email"
                className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={!email} icon={faArrowRight}>
            Login
          </Button>
        </form>
        <div className="flex gap-2 justify-center items-center  rounded-2xl border-2 border-border bg-border px-4 py-2 w-full max-w-md font-bold text-primary">
          <FontAwesomeIcon icon={faQuestionCircle} />
          <p className="text-sm">
            Don't have an account?{' '}
            <Link
              to="/app/create-profile"
              search={(currentSearch) => ({
                ...currentSearch,
              })}
              className="text-primary-foreground"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default LoginPage;
