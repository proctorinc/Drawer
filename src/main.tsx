import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from '@tanstack/react-router';

import './styles.css';
import reportWebVitals from './reportWebVitals.ts';

import App from './pages/feed/Feed.tsx';
import CreateProfilePage from './pages/auth/CreateProfilePage.tsx';
import { UserProfileProvider } from './pages/profile/context/UserProfileContext.tsx';
import { DailyPromptProvider } from './daily/DailyPromptContext.tsx';
import { DrawingProvider } from './drawing/DrawingContext.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import { LoggingProvider } from './lib/posthog.tsx';
import UserProfilePage from './pages/profile/UserProfilePage.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PromptSubmissionPage from './pages/feed/PromptSubmissionPage';
import ActivityPage from './pages/activity/ActivityPage.tsx';
import { AuthProvider } from './auth/AuthContext.tsx';
import MyProfilePage from './pages/profile/MyProfilePage.tsx';
import { MyProfilePageProvider } from './pages/profile/context/MyProfileContext.tsx';
import AuthRoute from './auth/AuthRoute.tsx';
import { NotificationProvider } from './notifications/NotificationContext.tsx';
import AdminPage from './pages/admin/AdminPage.tsx';
import { AdminDashboardProvider } from './pages/admin/context/AdminDashboardContext.tsx';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <DailyPromptProvider>
            <Outlet />
          </DailyPromptProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
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
        <DrawingProvider>
          <App />
        </DrawingProvider>
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

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/activity',
  component: () => (
    <AuthRoute>
      <ActivityPage />
    </AuthRoute>
  ),
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

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/draw/admin',
  component: () => (
    <AuthRoute>
      <AdminDashboardProvider>
        <AdminPage />
      </AdminDashboardProvider>
    </AuthRoute>
  ),
});

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
  friendProfileRoute,
  calendarRoute,
  createProfileRoute,
  loginRoute,
  promptSubmissionRoute,
  adminRoute,
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
