'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import AdminAlertModal from '@/components/AdminAlertModal';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadAdminAlerts, setUnreadAdminAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [browserPermission, setBrowserPermission] = useState('default');
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const lastCheckedUserRef = useRef(null);

  const isDesktop = typeof window !== 'undefined' && 
    (!!window.__TAURI__ || 
     window.location.origin.startsWith('tauri://') || 
     window.location.origin.startsWith('file:') || 
     (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) ||
     window.location.href.startsWith('file:'));

  const fetchNotificationsList = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get('/notifications');
      const list = data.notifications || [];
      setNotifications(list);
      setUnreadCount(data.unreadCount || 0);

      // Extract unread system admin alerts
      const alerts = list.filter(n => n.type === 'system' && n.title === 'Admin Alert' && !n.isRead);
      setUnreadAdminAlerts(alerts);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service worker registration failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setUnreadAdminAlerts([]);
      setIsPushEnabled(false);
      lastCheckedUserRef.current = null;
      return;
    }

    fetchNotificationsList();

    const userId = user._id || user.id;
    if (lastCheckedUserRef.current !== userId) {
      lastCheckedUserRef.current = userId;

      if (typeof window !== 'undefined' && window.Capacitor) {
        registerCapacitorPush();
      } else if (isDesktop) {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            setBrowserPermission(permission);
            if (permission === 'granted') {
              toast.success('Real-time notifications enabled');
            }
          });
        }
      } else {
        checkPushSubscription().then(() => {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            requestBrowserPermission();
          }
        });
      }
    }

    if (!socket) return;

    const handleNotification = (data) => {
      // Fetch latest notifications to keep the state perfectly synced with real DB IDs
      fetchNotificationsList();
      
      toast((t) => (
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm text-[var(--color-text)]">{data.title || 'New Notification'}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.message || data.body || ''}</p>
        </div>
      ), {
        icon: '🔔',
        duration: 4000,
        position: 'top-right'
      });

      if (browserPermission === 'granted') {
        showBrowserNotification(data);
      }
    };

    const handleAdminAlert = (data) => {
      // Ignore alert if it was sent by this user
      if (user && (user._id === data.senderId || user.id === data.senderId)) {
        return;
      }

      // Immediately trigger a refetch so the new system broadcast is synced down
      fetchNotificationsList();
      
      toast((t) => (
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm text-[var(--color-text)]">{data.title || 'System Alert'}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.message || ''}</p>
        </div>
      ), {
        icon: '⚠️',
        duration: 5000,
        position: 'top-right'
      });

      // Also trigger browser notification
      if (browserPermission === 'granted') {
        showBrowserNotification({
          title: data.title || 'System Alert',
          message: data.message
        });
      }
    };

    socket.on('notification:new', handleNotification);
    socket.on('admin:alert', handleAdminAlert);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('admin:alert', handleAdminAlert);
    };
  }, [user, socket, browserPermission, fetchNotificationsList, isDesktop]);

  const registerCapacitorPush = async () => {
    if (typeof window === 'undefined' || !window.Capacitor) return;
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Native push notification permission was not granted');
        return;
      }

      await PushNotifications.register();

      // Clear existing listeners to prevent duplicates
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (token) => {
        console.log('Capacitor FCM Registration successful, token:', token.value);
        try {
          await api.post('/notifications/push/fcm-token', { token: token.value });
          setIsPushEnabled(true);
        } catch (err) {
          console.error('Failed to send FCM token to backend:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Capacitor registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
        fetchNotificationsList();
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed: ', notification);
        const link = notification.notification?.data?.link;
        if (link) {
          window.location.href = link;
        }
      });

    } catch (err) {
      console.error('Failed to register Capacitor push notifications:', err);
    }
  };

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      const publicKeyResponse = await api.get('/notifications/push/vapid-public-key');
      if (!publicKeyResponse || !publicKeyResponse.publicKey) {
        setIsPushEnabled(!!subscription);
        return;
      }

      const serverVapidKey = publicKeyResponse.publicKey;
      const registeredVapidKey = localStorage.getItem('registered_vapid_key');

      // If subscription exists but VAPID key changed (e.g. server restarted), unsubscribe & force resubscribe
      if (subscription && registeredVapidKey !== serverVapidKey) {
        console.log('[Push] Server VAPID key mismatch. Re-subscribing...');
        try {
          await subscription.unsubscribe();
        } catch (_) {}
        try {
          await api.delete('/notifications/push/unsubscribe');
        } catch (_) {}
        localStorage.removeItem('registered_vapid_key');
        subscription = null;
      }

      setIsPushEnabled(!!subscription);

      // Auto-subscribe if browser permission is already granted but no subscription exists (or was just cleared)
      if (!subscription && Notification.permission === 'granted') {
        try {
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(serverVapidKey),
          });

          await api.post('/notifications/push/subscribe', { subscription: newSubscription });
          localStorage.setItem('registered_vapid_key', serverVapidKey);
          setIsPushEnabled(true);
        } catch (subErr) {
          console.error('Failed to auto-subscribe web browser push:', subErr);
        }
      }
    } catch (err) {
      console.error('Error in checkPushSubscription:', err);
    }
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
      data: {
        link: data.link || '/notifications',
      }
    };

    try {
      // Use service worker to show notification (supported on mobile browsers/PWA and desktop)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, options);
        }).catch(() => {
          new Notification(title, options);
        });
      } else {
        new Notification(title, options);
      }
    } catch (_) {
      try {
        new Notification(title, options);
      } catch (_) {}
    }
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
    if (typeof window !== 'undefined' && window.Capacitor) {
      await registerCapacitorPush();
      return;
    }

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
      if (!publicKeyResponse || !publicKeyResponse.publicKey) {
        console.warn('Web Push VAPID keys are not configured on the backend.');
        return;
      }

      const serverVapidKey = publicKeyResponse.publicKey;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(serverVapidKey),
      });

      await api.post('/notifications/push/subscribe', { subscription });
      localStorage.setItem('registered_vapid_key', serverVapidKey);
      
      setIsPushEnabled(true);
      toast.success('Push notifications enabled');
    } catch (err) {
      console.error('Push subscription error:', err);
      toast.error('Failed to enable push notifications');
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.Capacitor) {
        await api.delete('/notifications/push/unsubscribe');
        setIsPushEnabled(false);
        toast.success('Push notifications disabled');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      await api.delete('/notifications/push/unsubscribe');
      localStorage.removeItem('registered_vapid_key');
      setIsPushEnabled(false);
      toast.success('Push notifications disabled');
    } catch (err) {
      console.error('Push unsubscription error:', err);
      toast.error('Failed to disable push notifications');
    }
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && window.Capacitor) {
      await registerCapacitorPush();
      return;
    }

    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    
    if (permission === 'granted') {
      if (!isDesktop) {
        await subscribeToPush();
      } else {
        toast.success('Real-time notifications enabled');
      }
    } else if (permission === 'denied') {
      toast.error('Browser notifications blocked');
    }
  }, [subscribeToPush, isDesktop]);

  const markAsRead = useCallback(async (ids) => {
    try {
      await api.put('/notifications/read', { ids });
      setNotifications(prev =>
        prev.map(n => ids.includes(n._id) ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - ids.length));
      setUnreadAdminAlerts(prev => prev.filter(n => !ids.includes(n._id)));
    } catch (_) {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setUnreadAdminAlerts([]);
    } catch (_) {}
  }, []);

  const archiveNotification = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/archive`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      setUnreadAdminAlerts(prev => prev.filter(n => n._id !== id));
      // Re-fetch count/details
      fetchNotificationsList();
    } catch (_) {}
  }, [fetchNotificationsList]);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      notifications,
      unreadAdminAlerts,
      browserPermission,
      isPushEnabled,
      requestBrowserPermission,
      subscribeToPush,
      unsubscribeFromPush,
      markAsRead,
      markAllRead,
      archiveNotification,
      refreshNotifications: fetchNotificationsList,
    }}>
      {children}
      <AdminAlertModal />
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);