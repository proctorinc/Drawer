import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import type { FC, ReactNode } from 'react';

export type ConfirmOptions = {
  title: ReactNode;
  message?: ReactNode;
  /** The button that goes ahead, e.g. "delete" */
  confirmLabel?: string;
  /** The button that backs out, e.g. "keep it" */
  cancelLabel?: string;
};

export type AlertOptions = {
  title: ReactNode;
  message?: ReactNode;
  /** The one button, e.g. "ok" */
  okLabel?: string;
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;
type Tell = (options: AlertOptions) => Promise<void>;

const ConfirmContext = createContext<{ ask: Ask; tell: Tell } | null>(null);

/**
 * Asks "are you sure?" in the app's own dialog. Use this, never
 * window.confirm:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'delete your comment?' }))) return;
 */
export function useConfirm(): Ask {
  const dialogs = useContext(ConfirmContext);
  if (!dialogs)
    throw new Error('useConfirm needs a <ConfirmProvider> above it');
  return dialogs.ask;
}

/**
 * Tells the player something in the app's own dialog, with one button. Use
 * this, never window.alert:
 *
 *   const alert = useAlert();
 *   alert({ title: "couldn't delete that", message: err.message });
 */
export function useAlert(): Tell {
  const dialogs = useContext(ConfirmContext);
  if (!dialogs) throw new Error('useAlert needs a <ConfirmProvider> above it');
  return dialogs.tell;
}

type Pending = ConfirmOptions & {
  /** Just one button: an alert, not a question */
  single?: boolean;
  resolve: (ok: boolean) => void;
};

export const ConfirmProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const open = useCallback((next: Pending) => {
    // A second dialog while one is open backs out of the first
    pendingRef.current?.resolve(false);
    pendingRef.current = next;
    setPending(next);
  }, []);

  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => open({ ...options, resolve })),
    [open],
  );

  const tell = useCallback<Tell>(
    ({ okLabel = 'ok', ...options }) =>
      new Promise<void>((resolve) =>
        open({
          ...options,
          confirmLabel: okLabel,
          single: true,
          resolve: () => resolve(),
        }),
      ),
    [open],
  );

  const value = useMemo(() => ({ ask, tell }), [ask, tell]);

  const answer = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmDialog
          {...pending}
          onConfirm={() => answer(true)}
          onCancel={() => answer(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
};

type DialogProps = ConfirmOptions & {
  single?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: FC<DialogProps> = ({
  title,
  message,
  confirmLabel = 'yes',
  cancelLabel = 'never mind',
  single = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Don't also close a sheet or modal sitting under the dialog
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      // Above every other layer, including admin overlays at z-[9999]
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      // Inside clickable rows: don't let taps in the dialog reach them
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-ink/40 animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative flex flex-col gap-4 w-full max-w-sm p-5 bg-paper border-2 border-ink rounded-sketch shadow-pencil animate-in slide-in-from-bottom-8 fade-in duration-300 ease-[var(--ease-spring)]">
        <div className="flex flex-col gap-1">
          <h2
            id={titleId}
            className="font-accent font-bold text-2xl leading-tight"
          >
            {title}
          </h2>
          {message && (
            <p id={messageId} className="text-pencil">
              {message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button autoFocus={single} disableLoad onClick={onConfirm}>
            {confirmLabel}
          </Button>
          {/* The safe choice gets focus, so a stray Enter doesn't go ahead */}
          {!single && (
            <Button
              autoFocus
              disableLoad
              variant="base"
              size="sm"
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
