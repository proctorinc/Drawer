self.addEventListener('push', function(event) {
  console.log('🔔 Service Worker: Push event received!');
  console.log('🔔 Service Worker: Event data:', event.data);
  console.log('🔔 Service Worker: Event type:', event.type);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Error parsing push data:', error);
    data = {};
  }
  
  const title = data.title || 'New Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.png',
    badge: '/favicon-32x32.png',
    data: {
      url: data.url || '/',
      type: data.type || 'general',
      userId: data.userId || '',
      username: data.username || '',
      action: data.action || ''
    },
    tag: `${data.type}-${data.userId || 'general'}`, // Better grouping by type and user
    requireInteraction: false,
    silent: false,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/favicon-32x32.png'
      }
    ]
  };
  
  console.log('🔔 Service Worker: About to show notification:', { title, options });
  
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('🔔 Service Worker: Notification shown successfully!');
      })
      .catch((error) => {
        console.error('🔔 Service Worker: Error showing notification:', error);
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  // Every app page lives under /draw; anything else is a 404
  const url = data.url || '/draw';

  // Service workers have no `window`; resolve against the worker's own origin
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Reuse an open tab of the app if there is one
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(function(focused) {
            return focused.url === target ? focused : focused.navigate(target);
          });
        }
      }
      return clients.openWindow(target);
    })
  );
});

// The browser can expire or rotate a subscription on its own. Replace it right
// away with the same key so pushes keep arriving; the worker can't reach the
// signed-in API, so the app saves the new one to the server on its next open.
self.addEventListener('pushsubscriptionchange', function(event) {
  const key = event.oldSubscription && event.oldSubscription.options.applicationServerKey;
  if (event.newSubscription || !key) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .catch(function(error) {
        console.error('🔔 Service Worker: Failed to renew push subscription:', error);
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.data);
});

// Handle service worker installation
self.addEventListener('install', function(event) {
  console.log('🔔 Service Worker: Installing...');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  console.log('🔔 Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', function(event) {
  console.log('🔔 Service Worker: Message received:', event.data);
});
