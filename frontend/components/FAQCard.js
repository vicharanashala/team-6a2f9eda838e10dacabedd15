import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function FAQCard({ faq, isSelected, onSelect }) {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(faq.isSaved || false);
  const [saving, setSaving] = useState(false);

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
      className={`card-hover p-6 block border-2 transition-all duration-300 ${
        isSelected 
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-subtle)]' 
          : 'border-transparent hover:border-[var(--color-primary)]/30'
      }`}
      onClick={() => onSelect && onSelect(faq._id)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {faq.isOfficial && <span className="badge-green text-xs">Official</span>}
          {faq.category && <span className="badge-gray text-xs capitalize">{faq.category}</span>}
        </div>
        <button
          onClick={handleSave}
          className={`p-2 rounded-lg shrink-0 transition-all ${
            isSaved
              ? 'text-[var(--color-primary)] bg-[var(--color-primary-subtle)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]'
          }`}
          title={isSaved ? 'Unsave' : 'Save'}
        >
          <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">{faq.title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-5 line-clamp-2 leading-relaxed">{faq.description}</p>
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          {faq.itemCount || 0} items
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          {faq.viewCount || 0} views
        </span>
        {faq.saveCount > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            {faq.saveCount}
          </span>
        )}
      </div>
    </Link>
  );
}