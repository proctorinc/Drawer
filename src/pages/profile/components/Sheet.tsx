import { useEffect, useRef } from 'react';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { FC, ReactNode } from 'react';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A page that slides up from the bottom of the screen. Built on <dialog>, so
 * Escape, focus trapping and the backdrop come from the browser.
 */
const Sheet: FC<Props> = ({ title, open, onClose, children }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  // Keep the page behind still while you scroll the sheet
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      // A click on the dialog itself (not its contents) is on the backdrop
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="w-full max-w-md max-h-[88dvh] mx-auto mt-auto mb-0 p-0 bg-transparent text-ink overflow-y-auto overscroll-contain backdrop:bg-ink/40 open:animate-in open:slide-in-from-bottom-1/2 open:fade-in open:duration-300"
    >
      {open && (
        <div className="paper flex flex-col gap-5 min-h-[40dvh] px-6 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] border-2 border-b-0 border-ink rounded-t-[28px_22px]">
          <span
            aria-hidden="true"
            className="self-center w-12 h-1.5 rounded-full bg-line"
          />
          <div className="flex justify-between items-center">
            <h2 className="font-accent font-bold text-[32px] leading-none">
              {title}
            </h2>
            <button
              aria-label="Close"
              onClick={onClose}
              className="press flex items-center justify-center size-10 bg-white border-2 border-ink rounded-blob shadow-pencil-sm cursor-pointer text-xl"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};

export default Sheet;
