import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ButtonHTMLAttributes, FC, MouseEvent, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  icon?: IconDefinition;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const Button: FC<Props> = ({ icon, children, ...props }) => {
  const { className, onClick, ...otherProps } = props;
  const [isClicked, setIsClicked] = useState(false);

  const handleOnClick = (event: MouseEvent<HTMLButtonElement>) => {
    setIsClicked(true);
    setTimeout(() => {
      if (onClick) {
        onClick(event);
      }
      setIsClicked(false);
    }, 1000);
  };

  return (
    <button
      className={cn(
        'flex justify-center cursor-pointer disabled:cursor-default disabled:scale-100 hover:scale-105 transition-all duration-300 text-lg font-bold text-primary gap-2 items-center bg-secondary disabled:bg-base disabled:text-secondary px-6 py-3 rounded-2xl',
        isClicked && 'bg-primary/50',
        className,
      )}
      onClick={handleOnClick}
      {...otherProps}
    >
      {icon && !isClicked && <FontAwesomeIcon icon={icon} />}
      {isClicked && (
        <FontAwesomeIcon className="animate-spin" icon={faSpinner} />
      )}
      {children}
    </button>
  );
};

export default Button;
