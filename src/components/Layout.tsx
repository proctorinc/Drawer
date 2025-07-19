import type { FC, HTMLAttributes, ReactNode } from 'react';
import Navbar from './Navbar';
import useAuth from '@/auth/hooks/useAuth';
import Button from './Button';
import { faArrowLeft, faHome } from '@fortawesome/free-solid-svg-icons';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';

type Props = {
  header?: ReactNode;
  back?: boolean;
  children: ReactNode;
  backgroundProps?: HTMLAttributes<HTMLDivElement>;
  headerProps?: HTMLAttributes<HTMLDivElement>;
  hideHeader?: boolean;
};

const Layout: FC<Props> = ({
  header,
  back,
  children,
  headerProps,
  backgroundProps,
  hideHeader = false,
}) => {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div
      className="flex flex-col items-center justify-center bg-gradient-to-tr from-primary to-primary-foreground"
      {...backgroundProps}
    >
      <div
        className="z-0 sticky top-0 flex flex-col items-center max-w-md w-full gap-6 px-6 md:p-2"
        {...headerProps}
      >
        {!hideHeader && (
          <div className="sticky top-0 flex justify-center items-center text-center pb-6 pt-8 w-full">
            {back && canGoBack && (
              <Button
                variant="base"
                className="absolute left-0 top-6 w-10 bg-transparent text-secondary"
                icon={faArrowLeft}
                disableLoad
                onClick={() => router.history.back()}
              />
            )}
            {back && !canGoBack && (
              <Button
                variant="base"
                className="absolute left-0 top-6 w-10 bg-transparent text-secondary"
                icon={faHome}
                disableLoad
                onClick={() => navigate({ to: '/draw' })}
              />
            )}
            <h1 className="text-xl font-cursive font-extrabold tracking-widest text-border/80">
              The Daily Doodle
            </h1>
          </div>
        )}
        {header}
      </div>
      <div className="z-10 relative flex flex-col flex-grow w-full items-center p-6 md:p-2 gap-6 bg-base min-h-screen overflow-y-auto overflow-x-hidden pb-30 max-w-md rounded-t-4xl border-2 border-border">
        {children}
        {isAuthenticated && <Navbar />}
      </div>
    </div>
  );
};

export default Layout;
