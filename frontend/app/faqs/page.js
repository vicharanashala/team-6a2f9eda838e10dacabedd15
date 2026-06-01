'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import FAQCard from '@/components/FAQCard';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

function isInputFocused() {
  const active = document.activeElement;
  return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
}

function FAQsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [savedFaqIds, setSavedFaqIds] = useState(new Set());
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';

  const fetchSavedFaqs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get('/users/me/saved/faqs');
      const ids = new Set(data.saved?.map(s => s.faq?._id) || []);
      setSavedFaqIds(ids);
    } catch (_) {}
  }, [user]);

  const changeSort = (newSort) => {
    setSort(newSort);
    const params = new URLSearchParams();
    if (newSort !== 'newest') params.set('sort', newSort);
    if (category) params.set('category', category);
    const query = params.toString();
    router.push(`/faqs${query ? `?${query}` : ''}`);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/faqs', { page, category, sort }),
      api.get('/faqs', { limit: 100, sort: 'newest' }),
    ]).then(([data, all]) => {
      setFaqs(data.faqs || []);
      setPagination(data.pagination);
      const cats = [...new Set((all.faqs || []).map(f => f.category).filter(Boolean))];
      setCategories(cats);
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, sort]);

  useEffect(() => {
    fetchSavedFaqs();
  }, [fetchSavedFaqs]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [faqs]);

  const handleKeyDown = useCallback((e) => {
    if (isInputFocused()) return;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, faqs.length - 1));
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      router.push(`/faqs/${faqs[selectedIndex].slug}`);
    }
  }, [faqs, selectedIndex, router]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">FAQs</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Curated answers to commonly asked questions</p>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        {[
          { value: 'newest', label: 'Newest' },
          { value: 'views', label: 'Most Viewed' },
          { value: 'saved', label: 'Most Saved' },
          { value: 'title', label: 'A-Z' },
        ].map(s => (
          <button
            key={s.value}
            onClick={() => changeSort(s.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              sort === s.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/faqs"
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            !category ? 'bg-primary-600 text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
          }`}
        >
          All
        </Link>
        {categories.map(cat => (
          <Link
            key={cat}
            href={`/faqs?category=${cat}`}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              category === cat ? 'bg-primary-600 text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-[var(--color-border)] rounded w-1/2 mb-3" />
              <div className="h-4 bg-[var(--color-border)] rounded w-full mb-2" />
              <div className="h-4 bg-[var(--color-border)] rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : faqs.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">No FAQs found</h3>
          <p className="text-[var(--color-text-secondary)]">No FAQs available for this category yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {faqs.map((faq, idx) => (
              <FAQCard
                key={faq._id}
                faq={{ ...faq, isSaved: savedFaqIds.has(faq._id) }}
                isSelected={selectedIndex === idx}
                onSelect={() => setSelectedIndex(idx)}
              />
            ))}
          </div>
          <Pagination pagination={pagination} basePath="/faqs" queryParams={{ sort: sort !== 'newest' ? { sort } : {}, category }} />
        </>
      )}
    </div>
  );
}

export default function FAQsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 w-48 bg-gray-200 rounded mb-6" /></div>}>
      <FAQsPageContent />
    </Suspense>
  );
}