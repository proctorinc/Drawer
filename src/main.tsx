import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import './styles.css';
import reportWebVitals from './reportWebVitals.ts';

import App from './pages/feed/Feed.tsx';
import CreateProfilePage from './pages/auth/CreateProfilePage.tsx';
import { UserProfileProvider } from './pages/profile/UserProfileContext.tsx';
import { DailyPromptProvider } from './daily/DailyPromptContext.tsx';
import { DrawingProvider } from './drawing/DrawingContext.tsx';
import AddFriendPage from './pages/AddFriendPage.tsx';
import LoginPage from './pages/auth/LoginPage.tsx';
import { LoggingProvider } from './lib/posthog.tsx';
import UserProfilePage from './pages/profile/components/UserProfilePage.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => (
    <UserProfileProvider>
      <DailyPromptProvider>
        <DrawingProvider>
          <App />
        </DrawingProvider>
      </DailyPromptProvider>
    </UserProfileProvider>
  ),
});

const userProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/user-profile',
  component: () => (
    <UserProfileProvider>
      <UserProfilePage />
    </UserProfileProvider>
  ),
});

const createProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/create-profile',
  component: () => (
    <UserProfileProvider>
      <CreateProfilePage />
    </UserProfileProvider>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/login',
  component: () => (
    <UserProfileProvider>
      <LoginPage />
    </UserProfileProvider>
  ),
});

const addFriendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/add-friend/$userId',
  component: () => (
    <UserProfileProvider>
      <AddFriendPage />
    </UserProfileProvider>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  userProfileRoute,
  createProfileRoute,
  loginRoute,
  addFriendRoute,
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
