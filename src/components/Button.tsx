import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ButtonHTMLAttributes, FC, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  icon?: IconDefinition;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const Button: FC<Props> = ({ icon, children, ...props }) => {
  const { className, ...otherProps } = props;

  return (
    <button
      className={cn(
        'flex justify-center cursor-pointer disabled:cursor-default disabled:scale-100 hover:scale-110 transition-all duration-300 text-lg gap-2 items-center bg-gradient-to-tr from-blue-600 to-purple-600 font-bold px-6 py-3 rounded-2xl shadow-md disabled:opacity-50',
        className,
      )}
      {...otherProps}
    >
      {children}
      {icon && <FontAwesomeIcon icon={icon} />}
    </button>
  );
};

export default Button;
