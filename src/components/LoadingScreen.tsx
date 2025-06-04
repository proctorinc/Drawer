import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const LoadingScreen = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-primary-foreground">
      <div className="flex flex-col gap-20 flex-grow items-center justify-center max-w-md">
        <h1 className="text-4xl font-cursive tracking-widest text-secondary">
          Daily Doodle
        </h1>
        <FontAwesomeIcon
          size="2x"
          icon={faSpinner}
          className="animate-spin text-secondary"
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
