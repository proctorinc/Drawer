import type { FC, HTMLAttributes, ReactNode } from 'react';
import Navbar from './Navbar';
import useAuth from '@/auth/hooks/useAuth';
import Button from './Button';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from '@tanstack/react-router';

type Props = {
  header?: ReactNode;
  back?: boolean;
  children: ReactNode;
  backgroundProps?: HTMLAttributes<HTMLDivElement>;
  headerProps?: HTMLAttributes<HTMLDivElement>;
};

const Layout: FC<Props> = ({
  header,
  back,
  children,
  headerProps,
  backgroundProps,
}) => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div
      className="flex flex-col items-center justify-center"
      {...backgroundProps}
    >
      <div
        className="z-0 sticky top-0 flex flex-col items-center max-w-md w-full gap-6 px-6 md:p-2"
        {...headerProps}
      >
        <div className="sticky top-0 flex justify-center items-center text-center pb-6 pt-8 w-full">
          {back && (
            <Button
              variant="base"
              className="absolute left-4 top-6 w-10 bg-primary-foreground text-secondary"
              icon={faArrowLeft}
              disableLoad
              onClick={() => router.history.back()}
            />
          )}
          <h1 className="text-xl font-cursive font-extrabold tracking-widest text-border">
            The Daily Doodle
          </h1>
        </div>
        {header}
      </div>
      <div className="z-10 relative flex flex-col flex-grow w-full items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md rounded-t-3xl border-2 border-border">
        {children}
        {isAuthenticated && <Navbar />}
      </div>
    </div>
  );
};

export default Layout;
