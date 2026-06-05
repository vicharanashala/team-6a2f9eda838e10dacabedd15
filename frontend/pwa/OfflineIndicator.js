'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

export default function OfflineIndicator({ isOnline }) {
  const [showStatus, setShowStatus] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Prevent toast alerts on initial page mount/hydration
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      if (!isOnline) {
        setShowStatus(true);
      }
      return;
    }

    if (!isOnline) {
      setShowStatus(true);
      toast.error('You are offline. Serving cached FAQ and Questions data.', {
        id: 'network-status-toast',
        duration: 4000,
        position: 'top-right',
        icon: '🔌'
      });
    } else {
      toast.success('Back online! Live synchronization restored.', {
        id: 'network-status-toast',
        duration: 3500,
        position: 'top-right',
        icon: '⚡'
      });
      // Briefly keep status bar online state visible, then fade out
      const timer = setTimeout(() => {
        setShowStatus(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showStatus) return null;

  return (
    <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full border shadow-lg flex items-center gap-2 transition-all duration-300 text-xs font-semibold ${
      isOnline 
        ? 'bg-emerald-600/90 text-white border-emerald-500/30 backdrop-blur-md'
        : 'bg-amber-600/90 text-white border-amber-500/30 backdrop-blur-md'
    }`}>
      {isOnline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          <span>Back Online! Syncing...</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-red-200 animate-ping"></span>
          <span>Offline Mode: Using cached Q&As</span>
        </>
      )}
    </div>
  );
}
