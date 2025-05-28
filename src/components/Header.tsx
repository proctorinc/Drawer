import type { FC, ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  isLoading?: boolean;
};

const Header: FC<Props> = ({ title, subtitle, children, isLoading }) => {
  return (
    <div className="flex justify-between items-center bg-primary-foreground rounded-2xl border-border p-4 w-full max-w-md font-bold">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <div className="text-2xl h-[28px] w-[200px] bg-primary rounded-xl animate-pulse"></div>
          <div className="text-sm h-[16px] w-[100px] bg-primary rounded-xl animate-pulse"></div>
        </div>
      )}
      {!isLoading && (
        <div className="flex flex-col">
          <h1 className="text-2xl text-base">{title}</h1>
          <p className="text-sm text-secondary">{subtitle}</p>
        </div>
      )}
      {!isLoading && children}
      {isLoading && (
        <div className="h-12 w-12 rounded-full bg-primary animate-pulse" />
      )}
    </div>
  );
};

export default Header;
