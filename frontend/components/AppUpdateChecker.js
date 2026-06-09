'use client';
import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';



export default function AppUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const socket = useSocket();

  const checkUpdates = async (isManual = false) => {
    try {
      let installedVersionName = '1.0.0';
      let installedVersionCode = 1;

      // 1. Capacitor environment
      if (typeof window !== 'undefined' && window.Capacitor) {
        const { App } = require('@capacitor/app');
        const info = await App.getInfo();
        installedVersionName = info.version || '1.0.0';
        installedVersionCode = parseInt(info.build, 10) || 1;
      }
      // 2. Tauri environment
      else if (typeof window !== 'undefined' && window.__TAURI__) {
        try {
          const { getVersion } = require('@tauri-apps/api/app');
          installedVersionName = await getVersion();
          installedVersionCode = 1; // Default code
        } catch (tauriErr) {
          console.warn('Failed to get Tauri version:', tauriErr);
        }
      }
      // 3. Fallback: standard web environment
      else {
        if (isManual) {
          toast.success('Your app is up to date (Web Version).');
        }
        return;
      }

      setCurrentVersion(installedVersionName);

      // Fetch version info from backend
      const response = await fetch(`${api.baseUrl}/app-version`);
      if (!response.ok) {
        if (isManual) toast.error('Failed to connect to update server.');
        return;
      }
      const data = await response.json();

      // Compare versionCode (preferred) or versionName
      const isNewer = data.latestVersionCode > installedVersionCode || 
                      (data.latestVersion !== installedVersionName && installedVersionCode === 1);

      if (isNewer && isManual) {
        setUpdateInfo(data);
        setShowModal(true);
        toast.success(`New version v${data.latestVersion} is available!`);
      } else if (!isNewer && isManual) {
        toast.success('Your app is already up to date!');
      }
    } catch (err) {
      console.error('[Update Checker] Failed to check for updates:', err);
      if (isManual) {
        toast.error('Failed to check for updates.');
      }
    }
  };


  useEffect(() => {
    // Request push notification permissions on Capacitor startup
    if (typeof window !== 'undefined' && window.Capacitor) {
      const initPush = async () => {
        try {
          const { PushNotifications } = require('@capacitor/push-notifications');
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
          }
        } catch (err) {
          console.warn('[Push Permission Hook] Failed to initialize push notifications:', err);
        }
      };
      initPush();
    }
  }, []);

  useEffect(() => {
    const handleManualCheck = () => {
      checkUpdates(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app:check-update-manual', handleManualCheck);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app:check-update-manual', handleManualCheck);
      }
    };
  }, []);


  useEffect(() => {
    if (!socket) return;

    // Listen to real-time app update push events from admin panel quietly (no modals/interrupts)
    socket.on('app:update', (data) => {
      console.log('[Update Checker] Real-time app update notice received:', data);
    });

    return () => {
      socket.off('app:update');
    };
  }, [socket]);

  const handleUpdate = async () => {
    if (!updateInfo) return;
    
    let targetUrl = updateInfo.apkUrl;
    if (targetUrl && !targetUrl.startsWith('http')) {
      targetUrl = `https://prashnasarathi.vercel.app${targetUrl}`;
    }
    
    // Redirect user to the direct update URL (APK or downloads page)
    if (typeof window !== 'undefined' && window.Capacitor) {
      try {
        const { Browser } = require('@capacitor/browser');
        await Browser.open({ url: targetUrl });
      } catch (err) {
        console.error('Failed to open native browser:', err);
        window.open(targetUrl, '_system');
      }
    } else {
      window.open(targetUrl, '_blank');
    }
    
    setShowModal(false);
  };


  if (!showModal || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scale-in relative overflow-hidden">
        {/* Glow effect decorative element */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
        
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text)]">Update Available!</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
              Installed: v{currentVersion} &bull; Latest: v{updateInfo.latestVersion}
            </p>
          </div>
        </div>

        <div className="border-t border-b border-[var(--color-border)] py-3 my-1">
          <p className="text-xs font-semibold text-[var(--color-text)] mb-1.5">What's New:</p>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {updateInfo.changelog}
          </p>
        </div>

        <div className="flex gap-2.5 w-full mt-2">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] rounded-xl transition-all cursor-pointer animate-scale-in"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Update Now</span>
            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
