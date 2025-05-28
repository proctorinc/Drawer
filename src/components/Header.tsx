import type { FC, ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
};

const Header: FC<Props> = ({ title, subtitle, children, isLoading }) => {
  return (
    <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md font-bold">
      {isLoading && (
        <div className="flex flex-col gap-2">
          <div className="text-2xl h-[28px] w-[200px] bg-gray-700 rounded-xl animate-pulse"></div>
          <div className="text-sm h-[16px] w-[100px] bg-gray-700 rounded-xl animate-pulse"></div>
        </div>
      )}
      {!isLoading && (
        <div className="flex flex-col">
          <h1 className="text-2xl text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-sm text-gray-700 dark:text-gray-500">{subtitle}</p>
        </div>
      )}
      {!isLoading && children}
      {isLoading && (
        <div className="h-12 w-12 rounded-full bg-gray-700 animate-pulse" />
      )}
    </div>
  );
};

export default Header;
