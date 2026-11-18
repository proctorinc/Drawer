import { useEffect, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { PencilIcon, TrophyIcon } from './icons';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import { useGetInvitations } from '@/api/Api';
import { useDailyPrompt } from '@/daily/DailyPromptContext';

const TABS = ['/draw/trophies', '/draw', '/draw/profile/me'] as const;

// Each page mounts its own Navbar, so tab changes are tracked at module level.
// A freshly mounted bar starts on the previous tab and animates to the new one.
// The outgoing page's bar sees the new URL before it unmounts, so the change
// is recorded during render by whichever bar sees it first.
let currentTab: number | null = null;
let previousTab: number | null = null;
let changedAt = 0;
let hasEntered = false;

function noteTab(tab: number) {
  if (tab !== currentTab) {
    previousTab = currentTab;
    currentTab = tab;
    changedAt = Date.now();
  }
}

/** The tab a new bar should start on: the old one if we just switched */
function startingTab(tab: number) {
  const justSwitched = Date.now() - changedAt < 1000;
  return justSwitched && previousTab !== null ? previousTab : tab;
}

/** Left edge of the highlight blob, as a share of the bar's width */
const blobLeft = (tab: number) => `calc(${((2 * tab + 1) / 6) * 100}% - 28px)`;

const Navbar = () => {
  const user = useUser();
  const { pathname } = useLocation();
  const { data: invitationsData } = useGetInvitations();
  const { dailyPrompt } = useDailyPrompt();
  const activeTab = TABS.indexOf(pathname as (typeof TABS)[number]);
  noteTab(activeTab);
  const [blobTab, setBlobTab] = useState(() => startingTab(activeTab));
  const [enter] = useState(() => !hasEntered);

  useEffect(() => {
    hasEntered = true;
    const frame = requestAnimationFrame(() => setBlobTab(activeTab));
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const hasInvites = (invitationsData?.invitee.length ?? 0) > 0;
  const needsDoodle = dailyPrompt && !dailyPrompt.isCompleted;
  // The draw button grows into its own raised look, so the blob hides behind it
  const showBlob = blobTab === 0 || blobTab === 2;
  const drawExpanded = blobTab === 1;

  return (
    <div className="z-50 fixed inset-x-0 bottom-0 flex justify-center px-6 pb-[max(18px,env(safe-area-inset-bottom))] pointer-events-none">
      <nav
        aria-label="Main"
        className={cn(
          'relative flex items-center justify-around w-full max-w-[calc(28rem-48px)] h-[66px] bg-ink rounded-[30px_24px_32px_26px/26px_32px_24px_30px] shadow-pencil pointer-events-auto',
          enter && 'animate-in slide-in-from-bottom-10 fade-in duration-500',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-[10px] w-14 h-[46px] bg-butter rounded-[45%_55%_40%_60%/55%_45%_60%_40%] transition-[left,scale,opacity] duration-500 ease-[var(--ease-spring)]',
            !showBlob && 'scale-50 opacity-0',
          )}
          style={{ left: blobLeft(blobTab === -1 ? 1 : blobTab) }}
        />

        <Link
          to="/draw/trophies"
          aria-label="Trophies"
          aria-current={activeTab === 0 ? 'page' : undefined}
          className="relative flex items-center justify-center w-14 h-[46px] active:scale-90 transition-[scale] duration-300 ease-[var(--ease-spring)]"
        >
          <TrophyIcon
            size={27}
            key={activeTab === 0 ? 'on' : 'off'}
            className={cn(
              'transition-colors duration-300',
              activeTab === 0 ? 'text-ink animate-wiggle' : 'text-paper',
            )}
          />
        </Link>

        {/* Fixed-width slot so the side tabs stay put while the button grows */}
        <div className="flex justify-center w-[68px]">
          <Link
            to="/draw"
            aria-label="Today's doodle"
            aria-current={activeTab === 1 ? 'page' : undefined}
            className={cn(
              'flex flex-none items-center justify-center box-border border-[2.5px] rounded-[52%_48%_55%_45%/47%_55%_45%_53%] transition-[width,height,margin,background-color,border-color,box-shadow,rotate,scale] duration-500 ease-[var(--ease-spring)] active:scale-90',
              drawExpanded
                ? 'size-[68px] -mt-[30px] bg-butter border-ink shadow-[0_0_0_5px_var(--color-paper)] -rotate-4 hover:rotate-3'
                : 'size-[46px] mt-0 bg-transparent border-transparent shadow-[0_0_0_0_var(--color-paper)] hover:bg-paper/10',
            )}
          >
            <PencilIcon
              size={drawExpanded ? 30 : 27}
              strokeWidth={drawExpanded ? 2.1 : 2}
              fill={drawExpanded ? 'var(--color-coral)' : undefined}
              className={cn(
                'transition-colors duration-300',
                drawExpanded ? 'text-ink' : 'text-paper',
                needsDoodle && 'animate-nudge',
              )}
            />
          </Link>
        </div>

        <Link
          to="/draw/profile/me"
          aria-label="My book"
          aria-current={activeTab === 2 ? 'page' : undefined}
          className="relative flex items-center justify-center w-14 h-[46px] active:scale-90 transition-[scale] duration-300 ease-[var(--ease-spring)]"
        >
          <UserProfileIcon
            user={user}
            size="sm"
            onClick={() => {}}
            className={cn(
              'rounded-full ring-2 transition-shadow duration-300',
              activeTab === 2 ? 'ring-ink' : 'ring-paper',
            )}
          />
          {hasInvites && (
            <span
              aria-label="New friend invites"
              className="absolute top-1 right-2 size-3 rounded-full bg-coral border-2 border-ink animate-in zoom-in-0 duration-300"
            />
          )}
        </Link>
      </nav>
    </div>
  );
};

export default Navbar;
