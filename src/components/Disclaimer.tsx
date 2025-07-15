import { useState, type FC, type ReactNode } from 'react';
import Banner from './Banner';
import Button from './Button';

type Props = {
  title?: string;
  children?: ReactNode;
};

const Disclaimer: FC<Props> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Banner className="flex flex-col gap-2 border-2 border-border text-secondary bg-base">
      <span className="py-2 text-primary">{title}</span>
      {isOpen && (
        <div className="flex flex-col gap-2 text-left">{children}</div>
      )}
      <Button disableLoad onClick={() => setIsOpen((prev) => !prev)} size="sm">
        {isOpen ? 'hide' : 'show more'}
      </Button>
    </Banner>
  );
};

type DisclaimerItemProps = {
  children: ReactNode;
};

export const DisclaimerItem: FC<DisclaimerItemProps> = ({ children }) => {
  return <span>- {children}</span>;
};

export default Disclaimer;
