'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [browserPermission, setBrowserPermission] = useState('default');
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/push-service-worker.js').catch(err => {
        console.log('Service worker registration failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setIsPushEnabled(false);
      return;
    }

    fetchUnreadCount();
    checkPushSubscription();

    if (!socket) return;

    const handleNotification = (data) => {
      setUnreadCount(prev => prev + 1);
      
      if (browserPermission === 'granted') {
        showBrowserNotification(data);
      }
    };

    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [user, socket, browserPermission]);

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushEnabled(!!subscription);
    } catch (_) {}
  };

  const fetchUnreadCount = async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch (_) {}
  };

  const showBrowserNotification = (data) => {
    if (Notification.permission !== 'granted') return;
    
    const title = data.title || 'New notification';
    const options = {
      body: data.message || '',
      icon: '/icon.png',
      badge: '/badge.png',
      tag: 'notification',
      requireInteraction: false,
    };

    try {
      new Notification(title, options);
    } catch (_) {}
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      
      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const publicKeyResponse = await api.get('/notifications/push/vapid-public-key');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKeyResponse.publicKey),
      });

      await api.post('/notifications/push/subscribe', { subscription });
      
      setIsPushEnabled(true);
      toast.success('Push notifications enabled');
    } catch (err) {
      console.error('Push subscription error:', err);
      toast.error('Failed to enable push notifications');
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      await api.delete('/notifications/push/unsubscribe');
      setIsPushEnabled(false);
      toast.success('Push notifications disabled');
    } catch (err) {
      console.error('Push unsubscription error:', err);
      toast.error('Failed to disable push notifications');
    }
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    
    if (permission === 'granted') {
      await subscribeToPush();
    } else if (permission === 'denied') {
      toast.error('Browser notifications blocked');
    }
  }, [subscribeToPush]);

  const markAsRead = useCallback(async (ids) => {
    try {
      await api.put('/notifications/read', { ids });
      setUnreadCount(prev => Math.max(0, prev - (ids?.length || prev)));
    } catch (_) {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read');
      setUnreadCount(0);
    } catch (_) {}
  }, []);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      browserPermission,
      isPushEnabled,
      requestBrowserPermission,
      subscribeToPush,
      unsubscribeFromPush,
      markAsRead,
      markAllRead,
      refreshUnreadCount: fetchUnreadCount,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);