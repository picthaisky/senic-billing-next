import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Register service worker if not already registered
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          return registration.pushManager.getSubscription();
        })
        .then(subscription => {
          setIsSubscribed(subscription !== null);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      
      // Fetch VAPID public key from backend
      const response = await apiClient.get('/notifications/vapid-public-key');
      const vapidPublicKey = response.data.publicKey;

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Send subscription to backend
      const subJson = subscription.toJSON();
      await apiClient.post('/notifications/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from backend
        await apiClient.delete(`/notifications/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`);
      }
      
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }, [isSupported]);

  const sendTestNotification = useCallback(async () => {
    try {
      await apiClient.post('/notifications/test', {});
      return true;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}
