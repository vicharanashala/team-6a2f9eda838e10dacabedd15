import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function FAQCard({ faq, isSelected, onSelect, onDeleteSuccess }) {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(faq?.isSaved || false);
  const [saving, setSaving] = useState(false);

  if (!faq) return null;

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the FAQ page "${faq.title}"? This will delete all items under it.`)) return;
    try {
      await api.delete(`/faqs/${faq._id}`);
      toast.success('FAQ page deleted successfully');
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to delete FAQ page');
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please login to report'); return; }
    const reason = prompt(`Please specify your reason for reporting the FAQ "${faq.title}":`);
    if (!reason || !reason.trim()) return;
    try {
      await api.post('/admin/reports', {
        subject: `Report FAQ Page: ${faq.title}`,
        description: reason.trim(),
        pageUrl: `/faqs/${faq.slug}`
      });
      toast.success('FAQ reported successfully. Our team will review it.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please login to save'); return; }
    if (saving) return;

    setSaving(true);
    try {
      if (isSaved) {
        await api.delete(`/users/me/saved/faqs/${faq._id}`);
        setIsSaved(false);
        toast.success('FAQ unsaved');
      } else {
        await api.post('/users/me/saved/faqs', { faqId: faq._id });
        setIsSaved(true);
        toast.success('FAQ saved');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Link
      key={faq._id}
      href={`/faqs/${faq.slug}`}
      className={`group bg-[var(--color-bg-secondary)]/80 backdrop-blur-md rounded-2xl border p-6 block transition-all duration-300 ${
        isSelected 
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/20 shadow-md shadow-[var(--color-primary)]/5' 
          : 'border-[var(--color-border)]/60 hover:border-[var(--color-primary)]/30 hover:shadow-lg hover:-translate-y-1'
      }`}
      onClick={() => onSelect && onSelect(faq._id)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {faq.isOfficial && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Official
            </span>
          )}
          {faq.category && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] capitalize">
              {faq.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Report Button */}
          <button
            onClick={handleReport}
            className="p-2 rounded-xl shrink-0 transition-all border border-transparent text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-[var(--color-bg-tertiary)]"
            title="Report FAQ"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
          
          {/* Delete Button */}
          {isAdminOrMod && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl shrink-0 transition-all border border-transparent text-[var(--color-text-muted)] hover:text-red-500 hover:bg-[var(--color-bg-tertiary)]"
              title="Delete FAQ"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={`p-2 rounded-xl shrink-0 transition-all border ${
              isSaved
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/20'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>
      <h3 className="text-base font-bold text-[var(--color-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors leading-snug">
        {faq.title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-5 line-clamp-2 leading-relaxed">
        {faq.description}
      </p>
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]/40 pt-3">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          {faq.itemCount || 0} items
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          {faq.viewCount || 0} views
        </span>
      </div>
    </Link>
  );
}