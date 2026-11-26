import { useRef, useState } from 'react';
import type { FC } from 'react';
import useAuth from '@/auth/hooks/useAuth';
import { GearIcon, LogOutIcon, PencilIcon } from '@/components/icons';
import { useDismiss } from '@/components/useDismiss';

const menuItemClass =
  'flex items-center gap-2.5 w-full h-10 px-3 text-left text-lg hover:bg-paper cursor-pointer';

/** A gear on your cover that drops down account things: your name, logging out */
const SettingsMenu: FC<{ onChangeName: () => void }> = ({ onChangeName }) => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <button
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="press grid place-items-center size-9 bg-white border-2 border-ink rounded-full shadow-pencil-sm cursor-pointer"
      >
        <GearIcon size={20} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Settings"
          className="absolute right-0 top-full mt-2 w-44 py-1 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm origin-top-right animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onChangeName();
            }}
            className={menuItemClass}
          >
            <PencilIcon size={18} />
            change my name
          </button>
          <button role="menuitem" onClick={logout} className={menuItemClass}>
            <LogOutIcon size={18} />
            log out
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
