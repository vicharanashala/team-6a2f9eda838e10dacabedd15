'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import FAQCard from '@/components/FAQCard';
import SimpleEditor from '@/components/SimpleEditor';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📌');
  const [addingCategory, setAddingCategory] = useState(false);
  const [showAddFAQModal, setShowAddFAQModal] = useState(false);
  const [newFAQTitle, setNewFAQTitle] = useState('');
  const [newFAQQuestion, setNewFAQQuestion] = useState('');
  const [newFAQAnswer, setNewFAQAnswer] = useState('');
  const [newFAQCategory, setNewFAQCategory] = useState('');
  const [addingFAQ, setAddingFAQ] = useState(false);

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

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      await api.post('/categories', { name: newCategoryName.trim(), icon: newCategoryIcon });
      toast.success('Category added');
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryIcon('📌');
      const all = await api.get('/faqs', { limit: 100, sort: 'newest' });
      const cats = [...new Set((all.faqs || []).map(f => f.category).filter(Boolean))];
      setCategories(cats);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddFAQ = async (e) => {
    e.preventDefault();
    if (!newFAQTitle.trim() || !newFAQQuestion.trim() || !newFAQAnswer.trim()) return;
    setAddingFAQ(true);
    try {
      const data = await api.post('/faqs', {
        title: newFAQTitle.trim(),
        category: newFAQCategory.trim() || undefined,
        items: [{
          question: newFAQQuestion.trim(),
          answer: newFAQAnswer,
        }],
      });
      toast.success('FAQ added successfully');
      setShowAddFAQModal(false);
      setNewFAQTitle('');
      setNewFAQQuestion('');
      setNewFAQAnswer('');
      setNewFAQCategory('');
      const all = await api.get('/faqs', { limit: 100, sort: 'newest' });
      setFaqs(all.faqs || []);
      const cats = [...new Set((all.faqs || []).map(f => f.category).filter(Boolean))];
      setCategories(cats);
      if (data.faq?.slug) {
        router.push(`/faqs/${data.faq.slug}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingFAQ(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">FAQs</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Curated answers to commonly asked questions</p>
        </div>
        {isAdminOrMod && (
          <button
            onClick={() => setShowAddFAQModal(true)}
            className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-colors"
          >
            + Add FAQ
          </button>
        )}
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
        {isAdminOrMod && (
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-3 py-1.5 text-sm rounded-lg font-medium bg-[var(--color-bg-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-border)] transition-colors"
          >
            + Add
          </button>
        )}
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

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Add New Category</h3>
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., About the internship"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="📌"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {addingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add FAQ Modal */}
      {showAddFAQModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddFAQModal(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Add New FAQ</h3>
            <form onSubmit={handleAddFAQ}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">FAQ Title</label>
                <input
                  type="text"
                  value={newFAQTitle}
                  onChange={(e) => setNewFAQTitle(e.target.value)}
                  placeholder="e.g., Getting Started Guide"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Category</label>
                <input
                  type="text"
                  value={newFAQCategory}
                  onChange={(e) => setNewFAQCategory(e.target.value)}
                  placeholder="e.g., General, Getting Started (optional)"
                  list="category-options"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                />
                <datalist id="category-options">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Question</label>
                <input
                  type="text"
                  value={newFAQQuestion}
                  onChange={(e) => setNewFAQQuestion(e.target.value)}
                  placeholder="Enter the question"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Answer</label>
                <SimpleEditor
                  content={newFAQAnswer}
                  onChange={setNewFAQAnswer}
                  placeholder="Write the answer (Markdown supported)..."
                  minHeight="200px"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddFAQModal(false)}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingFAQ || !newFAQTitle.trim() || !newFAQQuestion.trim() || !newFAQAnswer.trim()}
                  className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {addingFAQ ? 'Adding...' : 'Add FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
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