import { cn } from '@/utils';
import {
  isValidElement,
  type FC,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

type CardProps = {
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const Card: FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 overflow-clip bg-card border-2 border-border rounded-2xl w-full shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] shadow-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

type CardContentProps = {
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const CardContent: FC<CardContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn('flex flex-col gap-4 p-4', className)} {...props}>
      {children}
    </div>
  );
};

type CardHeaderProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        {isValidElement(title) ? (
          title
        ) : (
          <h3 className="text-lg font-bold text-primary">{title}</h3>
        )}
        {isValidElement(subtitle) ? (
          subtitle
        ) : (
          <p className="text-sm font-semibold text-secondary">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
};

export { Card, CardContent, CardHeader };
