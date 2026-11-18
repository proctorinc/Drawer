import Logo from './Logo';

const LoadingScreen = () => {
  return (
    <div className="paper flex flex-col gap-8 h-dvh items-center justify-center">
      <Logo size="lg" className="animate-float" />
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
