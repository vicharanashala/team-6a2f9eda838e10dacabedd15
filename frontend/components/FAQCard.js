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
      className={`card-hover p-6 border-2 transition-all ${
        isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent'
      }`}
      onClick={() => onSelect && onSelect(faq._id)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {faq.isOfficial && <span className="badge-green text-xs">Official</span>}
          {faq.category && <span className="badge-gray text-xs capitalize">{faq.category}</span>}
        </div>
        <button
          onClick={handleSave}
          className={`p-1.5 rounded shrink-0 transition-colors ${
            isSaved
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30'
              : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={isSaved ? 'Unsave' : 'Save'}
        >
          <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">{faq.title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">{faq.description}</p>
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <span>{faq.itemCount || 0} items</span>
        <span>{faq.viewCount || 0} views</span>
        {faq.saveCount > 0 && <span>{faq.saveCount} saves</span>}
      </div>
    </Link>
  );
}