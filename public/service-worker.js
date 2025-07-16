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
    icon: '/logo.png',
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
  let url = data.url || '/';
  
  // Handle different notification types with specific navigation
  switch (data.type) {
    case 'friend_submission':
      // Navigate to the specific submission
      url = data.url || '/feed';
      break;
    case 'reaction':
    case 'comment':
      // Navigate to the submission where the reaction/comment occurred
      url = data.url || '/feed';
      break;
    default:
      url = data.url || '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window/tab open with the app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(window.location.origin) && 'focus' in client) {
          client.focus();
          // Navigate to the specific URL if it's different
          if (client.url !== url) {
            client.navigate(url);
          }
          return;
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
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
