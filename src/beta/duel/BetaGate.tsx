import { Link } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import useUser from '@/auth/hooks/useUser';
import Layout from '@/components/Layout';

/** Beta pages are for admins and the people they've let in; everyone else gets a polite no */
export const BetaGate: FC<{ children: ReactNode }> = ({ children }) => {
  const user = useUser();
  if (user.hasBeta || user.isAdmin) return <>{children}</>;
  return (
    <Layout back>
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="font-accent font-bold text-3xl">
          the beta lab is closed
        </h1>
        <p className="text-pencil">
          new things get tried out here first. you&apos;re not on the list yet!
        </p>
        <Link to="/draw" className="underline">
          back to drawing
        </Link>
      </div>
    </Layout>
  );
};
