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

    if (process.env.NODE_ENV !== 'development' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service worker registration failed:', err);
      });
    } else if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[PWA] Unregistered service worker in development mode (NotificationContext).');
        }
      });
    }
  }, []);

  // Track last seen unread count for detecting new notifications via polling
  const lastUnreadCountRef = useRef(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setUnreadAdminAlerts([]);
      setIsPushEnabled(false);
      lastCheckedUserRef.current = null;
      lastUnreadCountRef.current = 0;
      return;
    }

    fetchNotificationsList();

    const userId = user._id || user.id;
    if (lastCheckedUserRef.current !== userId) {
      lastCheckedUserRef.current = userId;

      if (typeof window !== 'undefined' && window.Capacitor) {
        registerCapacitorPush();
      } else if (isDesktop) {
        // Desktop (Tauri/Electron): just request OS permission, no Web Push subscription needed
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            setBrowserPermission(permission);
            if (permission === 'granted') {
              toast.success('Real-time notifications enabled');
            }
          });
        } else if (typeof window !== 'undefined' && 'Notification' in window) {
          setBrowserPermission(Notification.permission);
        }
      } else {
        // Web browser: check subscription status; if permission already granted, auto-subscribe
        // Do NOT call requestBrowserPermission here (would double-prompt). checkPushSubscription
        // handles auto-resubscription when permission === 'granted' internally.
        checkPushSubscription();
      }
    }

    // ── Socket.IO handlers (works in local dev / non-Vercel hosting) ──
    const handleNotification = (data) => {
      fetchNotificationsList();
      toast((t) => (
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm text-[var(--color-text)]">{data.title || 'New Notification'}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.message || data.body || ''}</p>
        </div>
      ), { icon: '🔔', duration: 4000, position: 'top-right' });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        showBrowserNotification(data);
      }
    };

    const handleAdminAlert = (data) => {
      if (user && (user._id === data.senderId || user.id === data.senderId)) return;
      fetchNotificationsList();
      toast((t) => (
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm text-[var(--color-text)]">{data.title || 'System Alert'}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.message || ''}</p>
        </div>
      ), { icon: '⚠️', duration: 5000, position: 'top-right' });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        showBrowserNotification({ title: data.title || 'System Alert', message: data.message });
      }
    };

    if (socket) {
      socket.on('notification:new', handleNotification);
      socket.on('admin:alert', handleAdminAlert);
    }

    // ── Polling fallback (Vercel serverless / when socket unavailable) ──
    // Poll every 8 seconds. When unread count increases, show in-app toast.
    const socketConnected = socket && socket.connected;
    let pollInterval = null;
    if (!socketConnected) {
      pollInterval = setInterval(async () => {
        try {
          const data = await api.get('/notifications');
          const newUnread = data.unreadCount || 0;
          const list = data.notifications || [];
          setNotifications(list);
          setUnreadCount(newUnread);
          const alerts = list.filter(n => n.type === 'system' && n.title === 'Admin Alert' && !n.isRead);
          setUnreadAdminAlerts(alerts);

          // If unread count increased since last poll → show toast + device notification for newest item
          if (newUnread > lastUnreadCountRef.current && list.length > 0) {
            const newest = list[0];
            toast((t) => (
              <div className="flex flex-col gap-1">
                <p className="font-bold text-sm text-[var(--color-text)]">{newest.title || 'New Notification'}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{newest.message || ''}</p>
              </div>
            ), { icon: '🔔', duration: 4000, position: 'top-right' });
            // Also fire device-level notification banner
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              showBrowserNotification(newest);
            }
          }
          lastUnreadCountRef.current = newUnread;
        } catch (_) {/* silent — user may be offline */}
      }, 8000);
    }

    // ── Service Worker → Page message bridge ──
    // When a Web Push arrives and the page is open, the SW sends a postMessage.
    // This lets us show the in-app toast even on Vercel (no socket needed).
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        fetchNotificationsList();
        const { title, message } = event.data;
        toast((t) => (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-sm text-[var(--color-text)]">{title || 'New Notification'}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{message || ''}</p>
          </div>
        ), { icon: '🔔', duration: 4000, position: 'top-right' });
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      if (socket) {
        socket.off('notification:new', handleNotification);
        socket.off('admin:alert', handleAdminAlert);
      }
      if (pollInterval) clearInterval(pollInterval);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
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
    console.log('[Push Debug] checkPushSubscription initiated.');
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push Debug] serviceWorker not in navigator');
      return;
    }
    if (!('PushManager' in window)) {
      console.warn('[Push Debug] PushManager not in window');
      return;
    }
    
    try {
      console.log('[Push Debug] Waiting for service worker registration to be ready...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push Debug] SW registration ready. Scope:', registration.scope);
      
      let subscription = await registration.pushManager.getSubscription();
      console.log('[Push Debug] Current subscription state:', subscription);

      console.log('[Push Debug] Fetching server VAPID public key...');
      const publicKeyResponse = await api.get('/notifications/push/vapid-public-key');
      console.log('[Push Debug] Server VAPID key response:', publicKeyResponse);
      if (!publicKeyResponse || !publicKeyResponse.publicKey) {
        console.warn('[Push Debug] No server VAPID key returned.');
        setIsPushEnabled(!!subscription);
        return;
      }

      const serverVapidKey = publicKeyResponse.publicKey;
      const registeredVapidKey = localStorage.getItem('registered_vapid_key');
      console.log('[Push Debug] serverVapidKey:', serverVapidKey);
      console.log('[Push Debug] registeredVapidKey:', registeredVapidKey);

      // If subscription exists but VAPID key changed (e.g. server restarted), unsubscribe & force resubscribe
      if (subscription && registeredVapidKey !== serverVapidKey) {
        console.log('[Push Debug] Server VAPID key mismatch. Re-subscribing...');
        try {
          await subscription.unsubscribe();
          console.log('[Push Debug] Successfully unsubscribed old subscription.');
        } catch (unsubErr) {
          console.warn('[Push Debug] Error unsubscribing:', unsubErr.message);
        }
        try {
          await api.delete('/notifications/push/unsubscribe');
          console.log('[Push Debug] Deleted subscription from backend.');
        } catch (apiDelErr) {
          console.warn('[Push Debug] Backend delete unsubscribe failed:', apiDelErr.message);
        }
        localStorage.removeItem('registered_vapid_key');
        subscription = null;
      }

      setIsPushEnabled(!!subscription);

      // Always sync subscription with the backend when logged in to prevent out-of-sync accounts
      if (subscription) {
        console.log('[Push Debug] Syncing existing subscription with backend...');
        try {
          await api.post('/notifications/push/subscribe', { subscription });
          localStorage.setItem('registered_vapid_key', serverVapidKey);
          setIsPushEnabled(true);
          console.log('[Push Debug] Sync complete. VAPID key saved locally.');
        } catch (syncErr) {
          console.error('[Push Debug] Failed to sync push subscription with backend:', syncErr.message);
        }
      } else if (Notification.permission === 'granted') {
        console.log('[Push Debug] No subscription found, but notification permission is granted. Subscribing...');
        try {
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(serverVapidKey),
          });
          console.log('[Push Debug] Created new subscription:', newSubscription);

          await api.post('/notifications/push/subscribe', { subscription: newSubscription });
          localStorage.setItem('registered_vapid_key', serverVapidKey);
          setIsPushEnabled(true);
          console.log('[Push Debug] Successfully saved new subscription to backend.');
        } catch (subErr) {
          console.error('[Push Debug] Failed to auto-subscribe web browser push:', subErr);
        }
      } else {
        console.log('[Push Debug] No subscription found and permission is not granted. Current permission:', Notification.permission);
      }
    } catch (err) {
      console.error('[Push Debug] Error in checkPushSubscription:', err);
    }
  };

  const showBrowserNotification = (data) => {
    console.log('[Notification Debug] showBrowserNotification called with data:', data);
    if (typeof window === 'undefined') {
      console.warn('[Notification Debug] window is undefined, aborting');
      return;
    }
    if (!('Notification' in window)) {
      console.warn('[Notification Debug] Notification API not supported in window');
      return;
    }
    console.log('[Notification Debug] Current window.Notification.permission:', window.Notification.permission);
    if (window.Notification.permission !== 'granted') {
      console.warn('[Notification Debug] Permission is not granted. Aborting display.');
      return;
    }
    
    const title = data.title || 'New notification';
    const options = {
      body: data.message || '',
      icon: '/logo.png', // Guaranteed to exist (logo.png)
      badge: '/pwa/icons/icon-72x72.png', // Guaranteed to exist
      tag: 'notification',
      requireInteraction: false,
      data: {
        link: data.link || '/notifications',
      }
    };

    // Prefer Service Worker Notification (most reliable for Chrome on Windows/Android and PWAs)
    if ('serviceWorker' in navigator) {
      console.log('[Notification Debug] Service Worker detected. Attempting SW notification...');
      navigator.serviceWorker.ready.then(reg => {
        console.log('[Notification Debug] SW ready. Invoking reg.showNotification...');
        reg.showNotification(title, options);
        console.log('[Notification Debug] SW showNotification call complete.');
      }).catch(swErr => {
        console.error('[Notification Debug] SW showNotification promise failed, falling back to standard Notification:', swErr);
        fallbackToStandardNotification(title, options);
      });
    } else {
      console.log('[Notification Debug] Service Worker not supported. Falling back to standard Notification...');
      fallbackToStandardNotification(title, options);
    }
  };

  const fallbackToStandardNotification = (title, options) => {
    try {
      console.log('[Notification Debug] Creating standard window.Notification:', title, options);
      const notification = new window.Notification(title, options);
      notification.onclick = (e) => {
        e.preventDefault();
        window.focus();
        const targetLink = options.data?.link || '/notifications';
        window.location.href = targetLink;
      };
      console.log('[Notification Debug] Standard notification instantiated successfully:', notification);
    } catch (err) {
      console.error('[Notification Debug] Standard Notification constructor failed:', err);
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
      showBrowserNotification,
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