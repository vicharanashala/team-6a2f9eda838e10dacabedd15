'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
      return;
    }

    fetchNotificationsList();
    checkPushSubscription();

    if (!socket) return;

    const handleNotification = (data) => {
      // Fetch latest notifications to keep the state perfectly synced with real DB IDs
      fetchNotificationsList();
      
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
      
      // Also trigger browser notification
      if (browserPermission === 'granted') {
        showBrowserNotification({
          title: 'System Alert',
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
  }, [user, socket, browserPermission, fetchNotificationsList]);

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushEnabled(!!subscription);
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