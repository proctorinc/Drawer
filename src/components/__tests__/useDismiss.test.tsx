import { useRef, useState } from 'react';
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDismiss } from '../useDismiss';

// jsdom has no PointerEvent
if (!('PointerEvent' in window)) {
  Object.assign(window, { PointerEvent: MouseEvent });
}

const Popover = ({ name }: { name: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <div ref={ref}>
      <button onClick={() => setOpen(!open)}>{name}</button>
      {open && <p>{name} menu</p>}
    </div>
  );
};

// The popovers live in the layout, so changing pages doesn't remount them
const Layout = () => (
  <>
    <Popover name="ann" />
    <Popover name="bob" />
    <p>elsewhere</p>
    <Link to="/other">other page</Link>
    <Outlet />
  </>
);

async function renderPage() {
  const rootRoute = createRootRoute({ component: Layout });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/' }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/other',
        component: () => <p>other</p>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText('elsewhere');
}

// A real tap presses down before it clicks
function tap(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.click(element);
}

describe('useDismiss', () => {
  it('keeps only one popover open at a time', async () => {
    await renderPage();
    tap(screen.getByText('ann'));
    tap(screen.getByText('bob'));
    expect(screen.queryByText('ann menu')).toBeNull();
    expect(screen.getByText('bob menu')).toBeTruthy();
  });

  it('closes when you press outside it', async () => {
    await renderPage();
    tap(screen.getByText('ann'));
    tap(screen.getByText('elsewhere'));
    expect(screen.queryByText('ann menu')).toBeNull();
  });

  it('stays open when you press inside it', async () => {
    await renderPage();
    tap(screen.getByText('ann'));
    fireEvent.pointerDown(screen.getByText('ann menu'));
    expect(screen.getByText('ann menu')).toBeTruthy();
  });

  it('closes when you change pages', async () => {
    await renderPage();
    tap(screen.getByText('ann'));
    // Navigating without pressing outside, like the back button or a tab above the backdrop
    await act(async () => {
      fireEvent.click(screen.getByText('other page'));
    });
    await screen.findByText('other');
    expect(screen.queryByText('ann menu')).toBeNull();
  });
});
