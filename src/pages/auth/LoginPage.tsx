import { useNavigate } from '@tanstack/react-router';
import React, { useEffect } from 'react';
import { SignIn } from '@clerk/react';
import Layout from '@/components/Layout';
import useAuth from '@/auth/hooks/useAuth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, needsProfile } = useAuth();

  useEffect(() => {
    if (user) {
      navigate({ to: '/draw' });
    } else if (needsProfile) {
      navigate({ to: '/auth/sign-up' });
    }
  }, [user, needsProfile]);

  return (
    <Layout>
      <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
        <SignIn
          routing="hash"
          signUpUrl="/auth/sign-up"
          fallbackRedirectUrl="/draw"
        />
      </div>
    </Layout>
  );
};

export default LoginPage;
