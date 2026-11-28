import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faAt,
  faAward,
  faBars,
  faBrush,
  faBullhorn,
  faCalendarDays,
  faChartLine,
  faFaceSmile,
  faFlask,
  faHatWizard,
  faImages,
  faLayerGroup,
  faLightbulb,
  faListUl,
  faMedal,
  faNoteSticky,
  faPalette,
  faRobot,
  faRotateLeft,
  faScroll,
  faSignature,
  faSliders,
  faStairs,
  faStamp,
  faUserAstronaut,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { AdminDashboardProvider } from './context/AdminDashboardContext';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import useUser from '@/auth/hooks/useUser';
import LogoIcon from '@/components/logo/LogoIcon';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

type NavItem = { to: string; label: string; icon: IconDefinition };

const NAV: Array<{ group: string; items: Array<NavItem> }> = [
  {
    group: 'pulse',
    items: [
      { to: '/draw/admin', label: 'overview', icon: faChartLine },
      { to: '/draw/admin/activity', label: 'activity log', icon: faListUl },
    ],
  },
  {
    group: 'people & art',
    items: [
      { to: '/draw/admin/users', label: 'users', icon: faUsers },
      { to: '/draw/admin/drawings', label: 'drawings', icon: faImages },
      { to: '/draw/admin/prompts', label: 'prompts', icon: faCalendarDays },
      {
        to: '/draw/admin/suggestions',
        label: 'suggestions',
        icon: faLightbulb,
      },
      { to: '/draw/admin/redos', label: 'redos', icon: faRotateLeft },
      { to: '/draw/admin/stickers', label: 'stickers', icon: faNoteSticky },
    ],
  },
  {
    group: 'rewards',
    items: [
      { to: '/draw/admin/achievements', label: 'achievements', icon: faAward },
      {
        to: '/draw/admin/decorations',
        label: 'decorations',
        icon: faHatWizard,
      },
      { to: '/draw/admin/reactions', label: 'reactions', icon: faFaceSmile },
      {
        to: '/draw/admin/progression',
        label: 'levels & quests',
        icon: faStairs,
      },
      { to: '/draw/admin/levels', label: 'level ranks', icon: faMedal },
    ],
  },
  {
    group: 'seasonal',
    items: [
      { to: '/draw/admin/events', label: 'events', icon: faLayerGroup },
      {
        to: '/draw/admin/announcements',
        label: 'announcements',
        icon: faBullhorn,
      },
    ],
  },
  {
    group: 'ai',
    items: [
      { to: '/draw/admin/ai', label: 'ai judges', icon: faRobot },
      { to: '/draw/admin/ai/test', label: 'testing ground', icon: faFlask },
      { to: '/draw/admin/ai/log', label: 'ai log', icon: faScroll },
      { to: '/draw/admin/ai/mentions', label: 'ai mentions', icon: faAt },
    ],
  },
  {
    group: 'beta zone',
    items: [
      { to: '/draw/admin/beta', label: 'sketch duel', icon: faFlask },
      { to: '/draw/admin/minted', label: 'minted polaroids', icon: faStamp },
    ],
  },
  {
    group: 'app',
    items: [{ to: '/draw/admin/settings', label: 'settings', icon: faSliders }],
  },
  {
    group: 'demos',
    items: [
      { to: '/draw/admin/drawing', label: 'drawing canvas', icon: faBrush },
      { to: '/draw/admin/brand', label: 'brand & ui', icon: faPalette },
      {
        to: '/draw/admin/avatars',
        label: 'default avatars',
        icon: faUserAstronaut,
      },
      { to: '/draw/admin/signature', label: 'signature', icon: faSignature },
    ],
  },
];

const NavLink = ({ to, label, icon }: NavItem) => (
  <Link
    to={to}
    activeOptions={{ exact: true }}
    className="flex items-center gap-3 px-3 py-1.5 text-lg rounded-sketch-alt border-2 border-transparent hover:bg-white hover:border-line"
    activeProps={{
      className: '!bg-butter !border-ink shadow-pencil-sm font-bold',
    }}
  >
    <FontAwesomeIcon icon={icon} fixedWidth className="text-pencil" />
    {label}
  </Link>
);

/** The logo, the nav, who you are and the way out: the sidebar and the phone menu share it */
const NavContents = ({ user }: { user: ReturnType<typeof useUser> }) => (
  <>
    <nav className="flex flex-col gap-5">
      {NAV.map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="px-3 text-sm uppercase tracking-wider text-pencil">
            {group}
          </span>
          {items.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </div>
      ))}
    </nav>
    <div className="flex items-center gap-2 mt-auto pt-4 border-t-2 border-dashed border-line">
      <UserProfileIcon user={user} size="sm" />
      <span className="truncate">{user.username}</span>
    </div>
    <Link
      to="/draw/profile/me"
      className="flex items-center gap-2 text-pencil hover:text-ink"
    >
      <FontAwesomeIcon icon={faArrowLeft} />
      back to the app
    </Link>
  </>
);

const Brand = () => (
  <Link to="/draw/admin" className="flex items-center gap-2">
    <LogoIcon theme={null} size={36} />
    <span className="font-accent font-bold text-2xl leading-none">
      drawer admin
    </span>
  </Link>
);

/**
 * The admin console. On a desktop the sub-pages sit in a sidebar; on smaller
 * screens it folds into a top bar whose menu opens over the whole screen.
 */
const AdminLayout = () => {
  const user = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });

  // Picking a page closes the menu
  useEffect(() => setMenuOpen(false), [path]);

  // The open menu covers the page: hold the page still and let Escape close it
  useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!user.isAdmin) {
    return (
      <div className="paper flex flex-col items-center justify-center gap-3 min-h-dvh text-center">
        <h1 className="font-accent font-bold text-3xl">admins only</h1>
        <Link to="/draw/profile/me" className="underline text-pencil">
          back to my book
        </Link>
      </div>
    );
  }

  return (
    <AdminDashboardProvider>
      <div className="paper flex flex-col lg:flex-row min-h-dvh">
        {/* Desktop: a sidebar */}
        <aside className="hidden lg:flex sticky top-0 flex-col gap-6 w-60 h-dvh shrink-0 px-4 py-6 overflow-y-auto border-r-2 border-ink bg-paper">
          <Brand />
          <NavContents user={user} />
        </aside>

        {/* Smaller screens: a top bar with a menu button */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-ink bg-paper">
          <Brand />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="open menu"
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            className="press grid place-items-center size-11 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm cursor-pointer"
          >
            <FontAwesomeIcon icon={faBars} className="text-xl" />
          </button>
        </header>
        {menuOpen && (
          <div
            id="admin-menu"
            role="dialog"
            aria-modal="true"
            aria-label="admin menu"
            className="lg:hidden fixed inset-0 z-50 flex flex-col gap-6 px-4 pt-3 pb-6 overflow-y-auto bg-paper"
          >
            <div className="flex items-center justify-between gap-3">
              <Brand />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="close menu"
                className="press grid place-items-center size-11 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} className="text-xl" />
              </button>
            </div>
            <NavContents user={user} />
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminDashboardProvider>
  );
};

export default AdminLayout;
