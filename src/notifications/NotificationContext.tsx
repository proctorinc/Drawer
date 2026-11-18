import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '@/api/apiClient';
import useAuth from '@/auth/hooks/useAuth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

function usesKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

/**
 * Makes sure this browser is subscribed with the server's current VAPID key
 * and that the server has the subscription. A subscription made with a
 * different key can never receive pushes, so it is replaced.
 */
async function syncSubscription(registration: ServiceWorkerRegistration) {
  const key = urlBase64ToUint8Array(await apiClient.getVapidPublicKey());

  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !usesKey(subscription, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

  await apiClient.subscribePush(subscription);
  return subscription;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

interface NotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission | null;
  subscription: PushSubscription | null;
  error: string | null;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const isSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | null>(
    isSupported ? Notification.permission : null,
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Re-sync an existing subscription on sign-in: subscriptions made with an
  // old key, or never saved by the server, would otherwise stay silent forever
  useEffect(() => {
    if (!isSupported || !isAuthenticated) return;

    (async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (!registration || !existing) return;
      setSubscription(existing);
      if (Notification.permission !== 'granted') return;

      setSubscription(await syncSubscription(registration));
    })().catch((err: unknown) => {
      console.error('Failed to sync push subscription:', err);
    });
  }, [isAuthenticated]);

  const subscribeToPush = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const registration =
        await navigator.serviceWorker.register('/service-worker.js');

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Notification permission not granted.');
        return;
      }

      setSubscription(await syncSubscription(registration));
    } catch (err) {
      setError(errorMessage(err, 'Failed to subscribe to push notifications.'));
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (!sub) {
        setSubscription(null);
        return;
      }
      await sub.unsubscribe();
      setSubscription(null);
      await apiClient.unsubscribePush(sub.endpoint);
    } catch (err) {
      setError(
        errorMessage(err, 'Failed to unsubscribe from push notifications.'),
      );
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        isSupported,
        permission,
        subscription,
        error,
        subscribeToPush,
        unsubscribeFromPush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
}
