self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.notification.body,
        icon: data.notification.icon || '/icon-192x192.png',
        badge: data.notification.badge || '/icon-192x192.png',
        vibrate: data.notification.vibrate || [100, 50, 100],
        data: data.notification.data || { url: '/' },
        actions: data.notification.actions || []
      };

      event.waitUntil(
        self.registration.showNotification(data.notification.title, options)
      );
    } catch (e) {
      console.error('Error parsing push data', e);
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Handle action buttons
  if (event.action === 'open_url') {
    const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else {
    // Default click behavior (open the app)
    const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});
