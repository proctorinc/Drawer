import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ButtonHTMLAttributes, FC, MouseEvent, ReactNode } from 'react';
import { cn } from '@/utils';

const buttonVariants = cva(
  'press inline-flex justify-center items-center gap-2 cursor-pointer disabled:cursor-default font-accent font-bold leading-none border-2 border-ink hover:-rotate-1 disabled:rotate-0 disabled:border-dashed disabled:border-line disabled:bg-transparent disabled:text-pencil disabled:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper rounded-sketch shadow-pencil',
        base: 'bg-white text-ink rounded-sketch-alt shadow-pencil-sm',
      },
      size: {
        sm: 'text-lg px-4 py-2',
        md: 'text-2xl px-6 py-3',
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
      onClick(event);
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
        isClicked && 'opacity-70',
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
