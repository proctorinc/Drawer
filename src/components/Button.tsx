import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ButtonHTMLAttributes, FC, MouseEvent, ReactNode } from 'react';
import { cn } from '@/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'flex justify-center cursor-pointer disabled:cursor-default transition-all duration-300 font-bold gap-2 items-center rounded-2xl disabled:bg-transparent disabled:text-secondary',
  {
    variants: {
      variant: {
        primary: 'bg-border text-primary hover:scale-105 disabled:scale-100',
        base: 'bg-base text-primary shadow-none',
      },
      size: {
        sm: 'text-sm px-4 py-2',
        md: 'text-lg px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type Props = {
  icon?: IconDefinition;
  disableLoad?: boolean;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button: FC<Props> = ({
  icon,
  children,
  variant,
  size,
  className,
  disableLoad = false,
  ...props
}) => {
  const { onClick, disabled, ...otherProps } = props;
  const [isClicked, setIsClicked] = useState(false);

  const handleOnClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick && !disableLoad) {
      setIsClicked(true);
      if (onClick) {
        onClick(event);
      }
      setTimeout(() => {
        setIsClicked(false);
      }, 1000);
    } else if (onClick) {
      onClick(event);
    }
  };

  return (
    <button
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size }),
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
