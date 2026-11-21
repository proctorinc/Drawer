import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/react';

import './styles.css';
import reportWebVitals from './reportWebVitals.ts';

import App from './pages/feed/Feed.tsx';
import CreateProfilePage from './pages/auth/CreateProfilePage.tsx';
import { UserProfileProvider } from './pages/profile/context/UserProfileContext.tsx';
import { DailyPromptProvider } from './daily/DailyPromptContext.tsx';
import { AIDialogueProvider } from './ai/AIDialogue.tsx';
import { AnimationQueueProvider } from './animations/AnimationQueue.tsx';
import ProgressWatcher from './animations/ProgressWatcher.tsx';
import AnnouncementWatcher from './announcements/AnnouncementWatcher.tsx';
import JudgeIntroWatcher from './ai/JudgeIntro.tsx';
import { TodayDrawingProvider } from './daily/TodayDrawingProvider.tsx';
import { MAX_AVATAR_SLOTS } from './api/Api.ts';
import LoginPage from './pages/auth/LoginPage.tsx';
import { LoggingProvider } from './lib/posthog.tsx';
import UserProfilePage from './pages/profile/UserProfilePage.tsx';
import PromptSubmissionPage from './pages/feed/PromptSubmissionPage';
import { BrandProvider } from './components/logo/BrandProvider.tsx';
import EventPage from './pages/event/EventPage.tsx';
import TrophiesPage from './pages/trophies/TrophiesPage.tsx';
import AllAchievementsPage, {
  isAchievementTab,
} from './pages/achievements/AchievementsPage.tsx';
import { AuthProvider } from './auth/AuthContext.tsx';
import MyProfilePage from './pages/profile/MyProfilePage.tsx';
import { MyProfilePageProvider } from './pages/profile/context/MyProfileContext.tsx';
import AuthRoute from './auth/AuthRoute.tsx';
import { NotificationProvider } from './notifications/NotificationContext.tsx';
import AdminLayout from './pages/admin/AdminLayout.tsx';
import OverviewPage from './pages/admin/pages/OverviewPage.tsx';
import ActivityPage from './pages/admin/pages/ActivityPage.tsx';
import UsersPage from './pages/admin/pages/UsersPage.tsx';
import DrawingsPage from './pages/admin/pages/DrawingsPage.tsx';
import PromptsPage from './pages/admin/pages/PromptsPage.tsx';
import SuggestionsPage from './pages/admin/pages/SuggestionsPage.tsx';
import AchievementsPage from './pages/admin/pages/AchievementsPage.tsx';
import DecorationsPage from './pages/admin/pages/DecorationsPage.tsx';
import LevelsPage from './pages/admin/pages/LevelsPage.tsx';
import ReactionsPage from './pages/admin/pages/ReactionsPage.tsx';
import ProgressionPage from './pages/admin/pages/ProgressionPage.tsx';
import EventsPage from './pages/admin/pages/EventsPage.tsx';
import AnnouncementsPage from './pages/admin/pages/AnnouncementsPage.tsx';
import AIJudgesPage from './pages/admin/pages/AIJudgesPage.tsx';
import AITestingGroundPage from './pages/admin/pages/AITestingGroundPage.tsx';
import AILogPage from './pages/admin/pages/AILogPage.tsx';
import DrawingDemoPage from './pages/admin/pages/DrawingDemoPage.tsx';
import BrandPage from './pages/admin/pages/BrandPage.tsx';
import BetaZonePage from './pages/admin/pages/BetaZonePage.tsx';
import DuelsPage from './beta/duel/DuelsPage.tsx';
import DuelPage from './beta/duel/DuelPage.tsx';
import DrawProfilePicPage from './pages/profile/DrawProfilePicPage.tsx';
import ProfileDrawingsPage from './pages/profile/DrawingsPage.tsx';
import StickersPage from './pages/profile/StickersPage.tsx';
import { Config } from './config/Config.ts';
import ImpersonationBanner from './components/ImpersonationBanner.tsx';
import type { AchievementTab } from './pages/achievements/AchievementsPage.tsx';
import type { FC } from 'react';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <ClerkProvider
      publishableKey={Config.CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/auth/login"
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrandProvider>
            <NotificationProvider>
              {/* Inside the router and the query client, since the stage it
                  renders uses Link and queries; AI reviews queue through it */}
              <AnimationQueueProvider>
                <AIDialogueProvider>
                  <DailyPromptProvider>
                    <ImpersonationBanner />
                    <ProgressWatcher />
                    <AnnouncementWatcher />
                    <JudgeIntroWatcher />
                    <Outlet />
                  </DailyPromptProvider>
                </AIDialogueProvider>
              </AnimationQueueProvider>
            </NotificationProvider>
          </BrandProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  ),
});

// Root route that redirects to /draw
const rootRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <AuthRoute>
      <Navigate to="/draw" replace />
    </AuthRoute>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw',
  component: () => (
    <AuthRoute>
      <MyProfilePageProvider>
        <TodayDrawingProvider>
          <App />
        </TodayDrawingProvider>
      </MyProfilePageProvider>
    </AuthRoute>
  ),
});

const userProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/me',
  component: () => (
    <AuthRoute>
      <MyProfilePageProvider>
        <MyProfilePage />
      </MyProfilePageProvider>
    </AuthRoute>
  ),
});

const drawProfilePicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/pic',
  // ?slot=0..2 draws into that face slot; without it, the next empty one
  validateSearch: (search: Record<string, unknown>): { slot?: number } => {
    const slot = Number(search.slot);
    return {
      slot:
        Number.isInteger(slot) && slot >= 0 && slot < MAX_AVATAR_SLOTS
          ? slot
          : undefined,
    };
  },
  component: () => (
    <AuthRoute>
      <MyProfilePageProvider>
        <DrawProfilePicPage />
      </MyProfilePageProvider>
    </AuthRoute>
  ),
});

const friendProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/$userId',
  component: () => (
    <AuthRoute>
      <UserProfileProvider>
        <UserProfilePage />
      </UserProfileProvider>
    </AuthRoute>
  ),
});

// Your own are under /me; the static segment there outranks $userId, so
// /draw/profile/me/... needs routes of its own
const myDrawingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/me/drawings',
  component: () => (
    <AuthRoute>
      <ProfileDrawingsPage />
    </AuthRoute>
  ),
});

const myStickersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/me/stickers',
  component: () => (
    <AuthRoute>
      <StickersPage />
    </AuthRoute>
  ),
});

const drawingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/$userId/drawings',
  component: () => (
    <AuthRoute>
      <ProfileDrawingsPage />
    </AuthRoute>
  ),
});

const stickersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/profile/$userId/stickers',
  component: () => (
    <AuthRoute>
      <StickersPage />
    </AuthRoute>
  ),
});

const trophiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/trophies',
  component: () => (
    <AuthRoute>
      <MyProfilePageProvider>
        <TrophiesPage />
      </MyProfilePageProvider>
    </AuthRoute>
  ),
});

const achievementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/achievements',
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: AchievementTab } => ({
    tab: isAchievementTab(search.tab) ? search.tab : undefined,
  }),
  component: () => (
    <AuthRoute>
      <AllAchievementsPage />
    </AuthRoute>
  ),
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/event/$slug',
  validateSearch: (search: Record<string, unknown>): { user?: string } => ({
    user: typeof search.user === 'string' ? search.user : undefined,
  }),
  component: () => (
    <AuthRoute>
      <EventPage />
    </AuthRoute>
  ),
});

// Old links (push notifications, bookmarks) still point here
const legacyActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/activity',
  component: () => <Navigate to="/draw/trophies" replace />,
});

const promptSubmissionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/submission/$submissionId',
  component: () => (
    <AuthRoute>
      <PromptSubmissionPage />
    </AuthRoute>
  ),
});

// The beta lab: admins and testers they've let in (each page checks)
const betaDuelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/beta',
  component: () => (
    <AuthRoute>
      <DuelsPage />
    </AuthRoute>
  ),
});

const betaDuelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/beta/duel/$duelId',
  component: () => (
    <AuthRoute>
      <DuelPage />
    </AuthRoute>
  ),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/admin',
  component: () => (
    <AuthRoute>
      <AdminLayout />
    </AuthRoute>
  ),
});

const adminPage = <TPath extends string>(path: TPath, component: FC) =>
  createRoute({ getParentRoute: () => adminRoute, path, component });

const adminPages = [
  adminPage('/', OverviewPage),
  adminPage('activity', ActivityPage),
  adminPage('users', UsersPage),
  adminPage('drawings', DrawingsPage),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'prompts',
    // ?event=<slug> shows just that event's days
    validateSearch: (search: Record<string, unknown>): { event?: string } => ({
      event: typeof search.event === 'string' ? search.event : undefined,
    }),
    component: PromptsPage,
  }),
  adminPage('suggestions', SuggestionsPage),
  adminPage('achievements', AchievementsPage),
  adminPage('decorations', DecorationsPage),
  adminPage('reactions', ReactionsPage),
  adminPage('progression', ProgressionPage),
  adminPage('levels', LevelsPage),
  adminPage('events', EventsPage),
  adminPage('announcements', AnnouncementsPage),
  adminPage('ai', AIJudgesPage),
  adminPage('ai/test', AITestingGroundPage),
  adminPage('ai/log', AILogPage),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'drawing',
    // ?day=YYYY-MM-DD previews that day's prompt
    validateSearch: (search: Record<string, unknown>): { day?: string } => ({
      day: typeof search.day === 'string' ? search.day : undefined,
    }),
    component: DrawingDemoPage,
  }),
  adminPage('brand', BrandPage),
  adminPage('beta', BetaZonePage),
];

const createProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/sign-up',
  component: () => <CreateProfilePage />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: () => <LoginPage />,
});

const routeTree = rootRoute.addChildren([
  rootRedirectRoute,
  indexRoute,
  userProfileRoute,
  drawProfilePicRoute,
  friendProfileRoute,
  myDrawingsRoute,
  myStickersRoute,
  drawingsRoute,
  stickersRoute,
  trophiesRoute,
  achievementsRoute,
  eventRoute,
  legacyActivityRoute,
  createProfileRoute,
  loginRoute,
  promptSubmissionRoute,
  betaDuelsRoute,
  betaDuelRoute,
  adminRoute.addChildren(adminPages),
]);

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <LoggingProvider>
        <RouterProvider router={router} />
      </LoggingProvider>
    </StrictMode>,
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
