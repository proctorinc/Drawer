import { useNavigate } from '@tanstack/react-router';
import React, { useEffect } from 'react';
import { SignIn } from '@clerk/react';
import Layout from '@/components/Layout';
import useAuth from '@/auth/hooks/useAuth';
import { useLogoIconUrl } from '@/components/logo/BrandProvider';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, needsProfile } = useAuth();
  // Clerk's card shows our logo, themed for any live event
  const logoUrl = useLogoIconUrl();

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
          appearance={{ options: { logoImageUrl: logoUrl } }}
          routing="hash"
          signUpUrl="/auth/sign-up"
          fallbackRedirectUrl="/draw"
        />
      </div>
    </Layout>
  );
};

export default LoginPage;
