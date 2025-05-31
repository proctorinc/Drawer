import { cn } from '@/utils';
import type { FC, HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const Card: FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 bg-card border-2 border-border rounded-2xl w-full',
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
  title?: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-lg font-bold text-primary">{title}</h3>
        <p className="text-sm font-bold text-secondary">{subtitle}</p>
      </div>
      {children}
    </div>
  );
};

export { Card, CardContent, CardHeader };
