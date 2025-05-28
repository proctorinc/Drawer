import {
  faArrowRight,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { Config } from '@/config/Config';
import Button from '@/components/Button';

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
      <div className="flex flex-col items-center p-4 gap-4 bg-gray-100 min-h-screen">
        <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
          <div className="flex flex-col gap-4 bg-white border border-gray-300 rounded-2xl w-full max-w-md p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Check your email
            </h2>
            <p className="text-gray-600">
              We've sent a verification link to {email}. Please check your inbox
              and click the link to verify your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 gap-4 bg-gray-100 min-h-screen">
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md px-6 py-2 w-full max-w-md font-bold">
          <div className="flex flex-col">
            <h1 className="text-2xl text-gray-900 dark:text-gray-100">
              Welcome!
            </h1>
            <p className="text-sm text-gray-700 dark:text-gray-500">Login</p>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 bg-white border border-gray-300 rounded-2xl w-full max-w-md p-4"
        >
          {error && <p className="text-center text-red-500">{error}</p>}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm text-gray-700 dark:text-gray-500"
            >
              Email
            </label>
            <div className="border border-gray-200 rounded-2xl">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-4 rounded-2xl"
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
        <div className="flex gap-2 justify-center items-center border border-gray-200 rounded-2xl bg-gray-200 px-4 py-2 w-full max-w-md text-gray-500">
          <FontAwesomeIcon icon={faQuestionCircle} />
          <p className="text-sm">
            Don't have an account?{' '}
            <Link
              to="/app/create-profile"
              search={(currentSearch) => ({
                ...currentSearch,
              })}
              className="text-blue-500"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
