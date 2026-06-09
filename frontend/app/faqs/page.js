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
  const [reloadCount, setReloadCount] = useState(0);
  const [dbCategories, setDbCategories] = useState([]);

  const handleDeleteCategory = async (catName) => {
    if (!confirm(`Are you sure you want to delete the category "${catName}"? This will unset this category on all questions and FAQs.`)) return;
    const matchedCat = dbCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    try {
      if (matchedCat) {
        await api.delete(`/categories/${matchedCat._id}`);
      } else {
        toast.error('Category configuration document not found.');
        return;
      }
      toast.success('Category deleted successfully');
      setReloadCount(c => c + 1);
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const handleReportCategory = async (catName) => {
    if (!user) {
      toast.error('Please login to report a category');
      return;
    }
    const reason = prompt(`Please specify your reason for reporting the category "${catName}":`);
    if (!reason || !reason.trim()) return;

    try {
      await api.post('/admin/reports', {
        subject: `Report Category: ${catName}`,
        description: reason.trim(),
        pageUrl: `/faqs?category=${encodeURIComponent(catName)}`
      });
      toast.success('Category reported successfully. Our team will review it.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    }
  };

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
      api.get('/categories').catch(() => ({ categories: [] }))
    ]).then(([data, all, catData]) => {
      setFaqs(data.faqs || []);
      setPagination(data.pagination);
      const cats = [...new Set((all.faqs || []).map(f => f.category).filter(Boolean))];
      setCategories(cats);
      setDbCategories(catData.categories || []);
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, sort, reloadCount]);

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

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      if (isAdminOrMod) {
        setShowAddFAQModal(true);
      } else {
        toast.error('Only administrators or moderators can create FAQs directly. Please ask a question instead!');
      }
    }
  }, [searchParams, isAdminOrMod]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Page Header */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">
            FAQs
          </span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">Curated answers to commonly asked questions</p>
      </div>

      {/* Sorting Tabs - Sleek segmented design */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6 border-b border-[var(--color-border)]/50 pb-4">
        <div className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-md p-1.5 rounded-xl border border-[var(--color-border)]/50 flex gap-1">
          {[
            { value: 'newest', label: 'Newest' },
            { value: 'views', label: 'Most Viewed' },
            { value: 'saved', label: 'Most Saved' },
            { value: 'title', label: 'A-Z' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => changeSort(s.value)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                sort === s.value
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]/50'
              }`}
            >
              {s.label}
            </button>
          ))}
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

      {/* Category Chips Selection */}
      <div className="flex flex-wrap gap-2.5 mb-8">
        <Link
          href="/faqs"
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
            !category 
              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-[var(--color-primary)]/10' 
              : 'bg-[var(--color-bg-secondary)]/80 text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text)]'
          }`}
        >
          All
        </Link>
        {categories.map(cat => {
          const isSelected = category === cat;
          return (
            <div
              key={cat}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border capitalize transition-all ${
                isSelected 
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-[var(--color-primary)]/10' 
                  : 'bg-[var(--color-bg-secondary)]/80 text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text)]'
              }`}
            >
              <Link href={`/faqs?category=${cat}`} className="text-xs font-semibold select-none leading-none">
                {cat}
              </Link>
              
              {/* Report Category */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReportCategory(cat);
                }}
                className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 ${
                  isSelected ? 'text-white/80 hover:text-white' : 'text-[var(--color-text-muted)] hover:text-amber-500'
                }`}
                title="Report Category"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </button>

              {/* Delete Category */}
              {isAdminOrMod && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteCategory(cat);
                  }}
                  className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0 ${
                    isSelected ? 'text-white/80 hover:text-white' : 'text-[var(--color-text-muted)] hover:text-red-500'
                  }`}
                  title="Delete Category"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        {isAdminOrMod && (
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-dashed border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]/30 transition-all"
          >
            + Add Category
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/40 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-[var(--color-border)] rounded w-2/3 mb-3" />
              <div className="h-4 bg-[var(--color-border)] rounded w-full mb-2" />
              <div className="h-4 bg-[var(--color-border)] rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/40 rounded-2xl p-16 text-center backdrop-blur-md">
          <h3 className="text-base font-bold text-[var(--color-text)] mb-2">No FAQs found</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">No FAQs available for this category yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faqs.map((faq, idx) => (
              <FAQCard
                key={faq._id}
                faq={{ ...faq, isSaved: savedFaqIds.has(faq._id) }}
                isSelected={selectedIndex === idx}
                onSelect={() => setSelectedIndex(idx)}
                onDeleteSuccess={() => setReloadCount(c => c + 1)}
              />
            ))}
          </div>
          <div className="mt-8">
            <Pagination pagination={pagination} basePath="/faqs" queryParams={{ sort: sort !== 'newest' ? { sort } : {}, category }} />
          </div>
        </>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl w-full max-w-md p-6 border border-[var(--color-border)]/50">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Add New Category</h3>
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., About the internship"
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Icon (emoji)</label>
                <input
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="📌"
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="btn-primary"
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
