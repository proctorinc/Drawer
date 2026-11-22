import { isValidElement } from 'react';
import type { FC, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils';

type CardProps = {
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const Card: FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 overflow-clip bg-card border-2 border-ink rounded-sketch w-full',
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
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>;

const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        {isValidElement(title) ? (
          title
        ) : (
          <h3 className="font-accent font-bold text-2xl leading-none text-ink">
            {title}
          </h3>
        )}
        {isValidElement(subtitle) ? (
          subtitle
        ) : (
          <p className="text-base text-pencil">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
};

export { Card, CardContent, CardHeader };
