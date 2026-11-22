import Logo from './Logo';
import { useFullscreenPage, useShell } from './AppShell';
import useAuth from '@/auth/hooks/useAuth';

/**
 * Inside the app, a page still loading keeps the masthead and navbar and shows
 * a scribble where its content will go. Before sign-in it's the full splash.
 */
const LoadingScreen = () => {
  const inShell = useShell() !== null;
  const { isAuthenticated } = useAuth();
  const inline = inShell && isAuthenticated;
  useFullscreenPage(!inline);

  return (
    <div
      className={
        inline
          ? 'flex flex-col flex-grow min-h-[60dvh] items-center justify-center pb-36'
          : 'paper flex flex-col gap-8 h-dvh items-center justify-center'
      }
    >
      {!inline && <Logo size="lg" className="animate-float" />}
      <svg
        width="120"
        height="16"
        viewBox="0 0 120 16"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={3}
        strokeLinecap="round"
        role="img"
        aria-label="Loading"
      >
        <path
          d="M4 8q9-8 18 0t18 0 18 0 18 0 18 0 18 0"
          pathLength={40}
          strokeDasharray={40}
          className="[animation:scribble_1.4s_ease-in-out_infinite_alternate]"
        />
      </svg>
    </div>
  );
};

export default LoadingScreen;
