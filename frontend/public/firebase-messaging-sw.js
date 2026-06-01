import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "quorafaq.firebaseapp.com",
  projectId: "quorafaq",
  storageBucket: "quorafaq.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    tag: data.tag || 'notification',
    data: data.data || {},
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PrashnaSārathi', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const link = event.notification.data?.link;
  if (link) {
    event.waitUntil(
      clients.openWindow(link)
    );
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});