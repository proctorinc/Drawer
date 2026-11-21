import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUserSecret } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStopImpersonating } from '@/api/Api';
import useAuth from '@/auth/hooks/useAuth';
import { switchAccount } from '@/animations/useProgressWatcher';

/** Shown on every page while an admin is viewing the app as someone else */
const ImpersonationBanner = () => {
  const { user } = useAuth();
  const stop = useStopImpersonating();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!user?.impersonatedBy) return null;

  const backToAdmin = () =>
    stop.mutate(undefined, {
      onSuccess: async () => {
        // Wait for /me to come back as the admin before the admin pages check it
        await switchAccount(queryClient);
        navigate({ to: '/draw/admin/users' });
      },
    });

  return (
    // Sticky in the page flow so it pushes content down instead of covering it
    <div className="paper z-[60] sticky top-0 flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
      <div className="flex items-center gap-3 max-w-md w-full bg-butter text-ink border-2 border-ink rounded-sketch shadow-pencil-sm pl-3 pr-1.5 py-1.5 font-accent">
        <FontAwesomeIcon icon={faUserSecret} />
        <span className="flex-1 min-w-0 truncate text-sm">
          viewing as <b>@{user.username}</b>
        </span>
        <button
          onClick={backToAdmin}
          disabled={stop.isPending}
          className="press shrink-0 inline-flex items-center gap-1.5 cursor-pointer bg-ink text-paper rounded-sketch-alt px-3 py-1 text-sm font-bold disabled:opacity-60"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          {stop.isPending ? 'leaving…' : `back to @${user.impersonatedBy}`}
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
