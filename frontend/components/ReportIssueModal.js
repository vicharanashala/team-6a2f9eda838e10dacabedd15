'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ReportIssueModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPageUrl(window.location.href);
      setSubject('');
      setDescription('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to report a site issue');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/reports', {
        subject: subject.trim(),
        description: description.trim(),
        pageUrl: pageUrl
      });
      toast.success('Site issue successfully reported! Thank you.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all duration-300 scale-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-gradient-to-r from-red-500/10 to-amber-500/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚨</span>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]">Report Site Issue / Flag</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Found a bug or glitch? Let the administrators know.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Broken profile picture upload error"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">Description</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail, including steps to reproduce if possible."
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">Context Page URL (Auto-captured)</label>
            <input
              type="text"
              readOnly
              value={pageUrl}
              className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--color-text-muted)] cursor-not-allowed outline-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 px-4 rounded-xl text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary py-2 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
