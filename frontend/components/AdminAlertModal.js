'use client';
import { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { formatDate } from '@/lib/utils';

export default function AdminAlertModal() {
  const { unreadAdminAlerts, markAsRead } = useNotifications() || {};
  const [submitting, setSubmitting] = useState(false);

  // If there are no unread system admin alerts, do not render anything
  if (!unreadAdminAlerts || unreadAdminAlerts.length === 0) {
    return null;
  }

  const handleAcknowledge = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const alertIds = unreadAdminAlerts.map(alert => alert._id);
      await markAsRead(alertIds);
    } catch (err) {
      console.error('Failed to acknowledge admin alert:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300" />

      {/* Modal Card */}
      <div className="relative bg-[var(--color-bg-secondary)] border-2 border-red-500/50 dark:border-red-500/30 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Top warning ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-[var(--color-border)] text-left">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0 text-2xl">
              🚨
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">System Broadcast</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Critical announcement from the administrators</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left max-h-[40vh] overflow-y-auto">
          {unreadAdminAlerts.map((alert) => (
            <div 
              key={alert._id} 
              className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30"
            >
              <p className="text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                {alert.message}
              </p>
              {alert.createdAt && (
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-2 font-mono opacity-60">
                  Broadcasted: {formatDate(alert.createdAt)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer with Acknowledge CTA */}
        <div className="p-6 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={handleAcknowledge}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold rounded-xl text-white shadow-md bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              'I have read and understood this alert'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
