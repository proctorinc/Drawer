import { Link, Outlet } from '@tanstack/react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faAward,
  faBrush,
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
  faPalette,
  faRobot,
  faScroll,
  faStairs,
  faUsers,
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
    items: [{ to: '/draw/admin/events', label: 'events', icon: faLayerGroup }],
  },
  {
    group: 'ai',
    items: [
      { to: '/draw/admin/ai', label: 'ai judges', icon: faRobot },
      { to: '/draw/admin/ai/test', label: 'testing ground', icon: faFlask },
      { to: '/draw/admin/ai/log', label: 'ai log', icon: faScroll },
    ],
  },
  {
    group: 'demos',
    items: [
      { to: '/draw/admin/drawing', label: 'drawing canvas', icon: faBrush },
      { to: '/draw/admin/brand', label: 'brand & ui', icon: faPalette },
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

/** The admin console: a sidebar of sub-pages, built for a desktop screen */
const AdminLayout = () => {
  const user = useUser();

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
      <div className="paper flex min-h-dvh">
        <aside className="sticky top-0 flex flex-col gap-6 w-60 h-dvh shrink-0 px-4 py-6 overflow-y-auto border-r-2 border-ink bg-paper">
          <Link to="/draw/admin" className="flex items-center gap-2">
            <LogoIcon theme={null} size={36} />
            <span className="font-accent font-bold text-2xl leading-none">
              drawer admin
            </span>
          </Link>
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
        </aside>
        <main className="flex-1 min-w-0 px-10 py-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminDashboardProvider>
  );
};

export default AdminLayout;
