import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { PushPin } from '@/components/PushPin';

type Props = {
  title?: string;
  children?: ReactNode;
};

/** A pinned-up sticky note that folds open */
const Disclaimer: FC<Props> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative flex flex-col gap-2 w-full px-5 pt-5 pb-3 bg-[#fff6c9] -rotate-1 shadow-[1px_2px_6px_rgba(43,42,51,0.15)]">
      <PushPin
        color={'#3a7bd5'}
        lean={14}
        className="absolute z-10 -top-[23px] left-1/2 -ml-4"
      />
      <span className="font-accent font-bold text-xl text-center leading-tight">
        {title}
      </span>
      {isOpen && (
        <div className="flex flex-col gap-1 text-left stagger">{children}</div>
      )}
      <button
        className="self-center px-3 py-1 text-pencil underline underline-offset-4 cursor-pointer"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'fold it up' : 'show more'}
      </button>
    </div>
  );
};

type DisclaimerItemProps = {
  children: ReactNode;
};

export const DisclaimerItem: FC<DisclaimerItemProps> = ({ children }) => {
  return <span>· {children}</span>;
};

export default Disclaimer;
