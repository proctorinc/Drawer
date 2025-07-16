import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
} from 'react';
import { Config } from '@/config/Config';
import { useSubscribePush, useUnsubscribePush } from '@/api/Api';

// Helper to convert base64 public key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

const VAPID_PUBLIC_KEY = Config.VAPID_PUBLIC_KEY;

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const subscribeToServer = useSubscribePush();
  const unsubscribeToServer = useUnsubscribePush();
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  // const subscribeToPush = useCallback(async () => {
  //   setError(null);
  //   if (!isSupported) {
  //     setError('Push notifications are not supported in this browser.');
  //     return;
  //   }
  //   try {
  //     const registration =
  //       await navigator.serviceWorker.register('/service-worker.js');
  //     let perm = Notification.permission;
  //     if (perm === 'default') {
  //       perm = await Notification.requestPermission();
  //     }
  //     setPermission(perm);
  //     if (perm !== 'granted') {
  //       setError('Notification permission not granted.');
  //       return;
  //     }
  //     const sub = await registration.pushManager.subscribe({
  //       userVisibleOnly: true,
  //       applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  //     });
  //     setSubscription(sub);
  //     subscribeToServer.mutate(sub);
  //   } catch (err: any) {
  //     setError(err?.message || 'Failed to subscribe to push notifications.');
  //   }
  // }, [isSupported]);

  const subscribeToPush = useCallback(async () => {
    setError(null);
    console.log('🔔 Starting push subscription process...');
    console.log('�� Is supported:', isSupported);
    console.log('🔔 VAPID_PUBLIC_KEY:', VAPID_PUBLIC_KEY ? 'Set' : 'NOT SET');

    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key is not configured.');
      return;
    }

    try {
      console.log('🔔 Registering service worker...');
      const registration =
        await navigator.serviceWorker.register('/service-worker.js');
      console.log('🔔 Service worker registered:', registration);

      let perm = Notification.permission;
      console.log('�� Current permission:', perm);

      if (perm === 'default') {
        console.log('🔔 Requesting permission...');
        perm = await Notification.requestPermission();
        console.log('🔔 Permission result:', perm);
      }
      setPermission(perm);

      if (perm !== 'granted') {
        setError('Notification permission not granted.');
        return;
      }

      console.log('🔔 Creating push subscription...');
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('🔔 Push subscription created:', sub);
      setSubscription(sub);

      console.log('🔔 Sending subscription to server...');
      try {
        await subscribeToServer.mutateAsync(sub);
        console.log('🔔 Subscription process complete!');
      } catch (err: any) {
        console.error('🔔 Error sending subscription to server:', err);
        setError(err?.message || 'Failed to send subscription to server');
        return;
      }
    } catch (err: any) {
      console.error('�� Error in subscribeToPush:', err);
      setError(err?.message || 'Failed to subscribe to push notifications.');
    }
  }, [isSupported, VAPID_PUBLIC_KEY, subscribeToServer]);

  const unsubscribeFromPush = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setError('No service worker registration found.');
        return;
      }
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setSubscription(null);
        unsubscribeToServer.mutate(sub.endpoint);
      } else {
        setError('No push subscription found.');
      }
    } catch (err: any) {
      setError(
        err?.message || 'Failed to unsubscribe from push notifications.',
      );
    }
  }, [isSupported]);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.pushManager.getSubscription().then((sub) => {
            setSubscription(sub);
          });
        }
      });
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const contextValue: NotificationContextType = {
    isSupported,
    permission,
    subscription,
    error,
    subscribeToPush,
    unsubscribeFromPush,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
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
