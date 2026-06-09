'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import RecommendedFAQs from '@/components/RecommendedFAQs';
import MascotCompanion from '@/components/MascotCompanion';
import { useVoiceCommand } from '@/context/VoiceCommandContext';

const CATEGORY_ICONS = {
  'About the internship': '💼',
  'Timing and dates': '📅',
  'NOC (No Objection Certificate)': '📄',
  'Selection, offer letter, and certificate': '📜',
  'Work, mentorship, and projects': '💻',
  'Code of conduct — communication channels': '📋',
  'Interviews Related': '🎤',
  'Certificate': '🏆',
  'Rosetta — your internship journal': '📔',
  'Phase 1 — coursework, Vibe LMS, and live sessions': '📚',
  'Spurti Points': '⭐',
  'ViBe Platform': '🎯',
  'Team Formation': '👥',
  'Yaksha Chat Related': '💬',
  'Discourse Related': '💭',
};

export default function HomePage() {
  const { user } = useAuth();
  const { openSearch } = useVoiceCommand();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localVotes, setLocalVotes] = useState({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📌');
  const [addingCategory, setAddingCategory] = useState(false);
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
      loadFAQs();
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

  const handleDeleteFAQ = async (faq) => {
    if (!confirm(`Are you sure you want to delete the FAQ page "${faq.title}"? This will delete all items under it.`)) return;
    try {
      await api.delete(`/faqs/${faq._id}`);
      toast.success('FAQ deleted successfully');
      loadFAQs();
    } catch (err) {
      toast.error(err.message || 'Failed to delete FAQ');
    }
  };

  const handleReportFAQ = async (faq) => {
    if (!user) {
      toast.error('Please login to report an FAQ');
      return;
    }
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

  const handleReportFAQItem = async (faq, item) => {
    if (!user) {
      toast.error('Please login to report a question');
      return;
    }
    const reason = prompt(`Please specify your reason for reporting the question "${item.question}":`);
    if (!reason || !reason.trim()) return;

    try {
      await api.post('/admin/reports', {
        subject: `Report FAQ Item: ${item.question}`,
        description: reason.trim(),
        pageUrl: `/faqs/${faq.slug}#${item._id}`
      });
      toast.success('Question reported successfully. Our team will review it.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    }
  };

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const [faqData, catData] = await Promise.all([
        api.get('/faqs', { limit: 100 }),
        api.get('/categories').catch(() => ({ categories: [] }))
      ]);
      const faqList = faqData.faqs || [];
      const dbCats = catData.categories || [];
      setDbCategories(dbCats);

      const categoryMap = {};
      faqList.forEach(faq => {
        const cat = faq.category || 'Uncategorized';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { name: cat, count: 0, items: [] };
        }
        const itemCount = faq.items ? faq.items.filter(i => i.isPublished).length : 0;
        categoryMap[cat].count += itemCount;
        categoryMap[cat].items.push(faq);
      });

      const sortedCategories = Object.values(categoryMap).sort((a, b) => b.count - a.count);
      setCategories([{ name: 'All Categories', count: faqList.reduce((acc, f) => acc + (f.items ? f.items.filter(i => i.isPublished).length : 0), 0) }, ...sortedCategories]);
      setFaqs(faqList);
    } catch (err) {
      console.error('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFAQs = selectedCategory === 'All Categories'
    ? faqs
    : faqs.filter(faq => faq.category === selectedCategory);

  const toggleFaq = (faqId) => {
    setExpandedFaq(expandedFaq === faqId ? null : faqId);
  };

  const handleFeedback = async (faqId, itemId, helpful) => {
    if (!user) { toast.error('Please login to vote'); return; }
    const currentVote = localVotes[itemId];
    const isUndo = currentVote === (helpful ? 'helpful' : 'notHelpful');
    try {
      const data = await api.post(`/faqs/${faqId}/items/${itemId}/feedback`, { helpful, undo: isUndo });
      if (data.voted === null) {
        setLocalVotes(prev => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        toast.success('Vote removed');
      } else {
        setLocalVotes(prev => ({ ...prev, [itemId]: data.voted }));
        toast.success(helpful ? 'Glad this helped!' : 'Thanks for the feedback');
      }
      setFaqs(prev => prev.map(faq => {
        if (faq._id !== faqId) return faq;
        return {
          ...faq,
          items: faq.items.map(item => {
            if (item._id !== itemId) return item;
            return { ...item, helpfulCount: data.helpfulCount, notHelpfulCount: data.notHelpfulCount };
          })
        };
      }));
    } catch (err) {
      toast.error(err.message);
    }
  };

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
      loadFAQs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingCategory(false);
    }
  };

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

  const getIcon = (category) => {
    return CATEGORY_ICONS[category] || '📌';
  };

  const isFaqFresh = (faq) => {
    if (!faq.items || faq.items.length === 0) return false;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return faq.items.some(item => item.lastReviewed && new Date(item.lastReviewed).getTime() > sevenDaysAgo);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Tech Hero Header */}
        <section className="max-w-3xl mb-12 mt-6 text-center mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-primary)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 px-2.5 py-0.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            KNOWLEDGE BASE
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-3 select-none bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] via-purple-500 to-indigo-500 hover:scale-[1.01] transition-transform duration-300">
            PrashnaSārathi
          </h1>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-relaxed mb-8">
            Your AI-Powered Community Q&A & Knowledge Base
          </p>

          {/* Hero Search */}
          <form onSubmit={handleSearchSubmit} className="relative mb-6 w-full max-w-2xl">
            <div className="flex items-center gap-3 px-4 py-3 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-[var(--color-primary)]/50 focus-within:ring-2 focus-within:ring-[var(--color-primary-subtle)] transition-all">
              <svg className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onFocus={(e) => {
                  e.target.blur();
                  openSearch(false);
                }}
                placeholder="Search questions, categories, tags..."
                className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] cursor-pointer"
              />
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Microphone Button */}
                <button
                  type="button"
                  title="Search with Voice"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSearch(true);
                  }}
                  className="p-1.5 rounded-full hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] active:scale-95 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Sidebar - Categories */}
          <aside className="lg:col-span-1 lg:sticky lg:top-24 bg-[var(--color-bg-secondary)] p-4 rounded-md border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)] mb-3">
              <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Categories</h2>
              <span className="text-[10px] font-mono bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                {categories.length - 1 || 0}
              </span>
            </div>
            <div className="flex flex-row lg:flex-col gap-1.5 max-h-[60vh] overflow-x-auto lg:overflow-y-auto pb-2.5 lg:pb-0 pr-1">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <div
                    key={cat.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCategory(cat.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCategory(cat.name);
                      }
                    }}
                    className={`shrink-0 w-auto lg:w-full text-left px-3 py-2 rounded-md text-xs cursor-pointer select-none transition-colors flex items-center justify-between gap-3 group ${
                      isSelected
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/25'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-sm shrink-0">{getIcon(cat.name)}</span>
                      <span className="truncate leading-none">{cat.name}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cat.name !== 'All Categories' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Report Button */}
                          <button
                            title="Report Category"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportCategory(cat.name);
                            }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-amber-500"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                          </button>

                          {/* Delete Button */}
                          {isAdminOrMod && (
                            <button
                              title="Delete Category"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat.name);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-red-500"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                        isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                      }`}>
                        {cat.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {isAdminOrMod && (
              <button
                onClick={() => setShowCategoryModal(true)}
                className="w-full mt-0 lg:mt-3 py-2 border border-dashed border-[var(--color-primary)]/30 hover:border-[var(--color-primary)]/60 text-[10px] text-[var(--color-primary)] font-mono rounded-md hover:bg-[var(--color-primary-subtle)]/30 transition-all text-center block"
              >
                + Add Category
              </button>
            )}
          </aside>

          {/* Main Content - FAQs */}
          <main className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]/50 mb-4">
              <h2 className="text-xs font-semibold text-[var(--color-text)]">
                {user 
                  ? (selectedCategory === 'All Categories' ? 'Recommended Frequently Asked Questions' : `Recommended: ${selectedCategory}`)
                  : (selectedCategory === 'All Categories' ? 'All Frequently Asked Questions' : selectedCategory)
                }
              </h2>
              {!user && (
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] font-mono">
                  <button
                    onClick={() => setExpandedFaq('all')}
                    className="hover:text-[var(--color-text)] transition-colors"
                  >
                    EXPAND ALL
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setExpandedFaq(null)}
                    className="hover:text-[var(--color-text)] transition-colors"
                  >
                    COLLAPSE ALL
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
                    <div className="h-4 bg-[var(--color-border)] rounded w-3/4 mb-2.5" />
                    <div className="h-3 bg-[var(--color-border)] rounded w-full mb-1.5" />
                    <div className="h-3 bg-[var(--color-border)] rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : user ? (
              <RecommendedFAQs limit={20} layout="grid" category={selectedCategory} />
            ) : (
              <div className="flex flex-col gap-3">
                {filteredFAQs.map((faq, faqIdx) => {
                  const isExpanded = expandedFaq === faq._id || expandedFaq === 'all';
                  const displayFaqIdx = String(faqIdx + 1).padStart(2, '0');
                  return (
                    <div 
                      key={faq._id} 
                      className={`bg-[var(--color-bg-secondary)] border rounded-md overflow-hidden transition-all duration-200 ${
                        isExpanded ? 'border-[var(--color-primary)]/50' : 'border-[var(--color-border)] hover:border-[var(--color-border-subtle)]'
                      }`}
                    >
                      {/* FAQ Header */}
                      <button
                        onClick={() => toggleFaq(faq._id)}
                        className="w-full p-4 text-left flex items-start justify-between gap-4 select-none"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{displayFaqIdx}</span>
                            {faq.isOfficial && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                                Official
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-[var(--color-primary)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-md capitalize">
                              {faq.category || 'General'}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                              {faq.items?.length || 0} items
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--color-text)] leading-snug">
                            {faq.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1 shrink-0">
                          {/* Report Button */}
                          <button
                            title="Report FAQ"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportFAQ(faq);
                            }}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-amber-500 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                          </button>
                          
                          {/* Delete Button */}
                          {isAdminOrMod && (
                            <button
                              title="Delete FAQ"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFAQ(faq);
                              }}
                              className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}

                          <svg
                            className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 mt-1 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Accordion Content */}
                      <div className={`faq-body-wrap ${isExpanded ? 'faq-body-wrap-open' : ''}`}>
                        <div className="faq-body-inner">
                          {faq.items?.length > 0 && (
                            <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]/40 bg-[var(--color-bg)]/20">
                              {faq.items
                                .filter(item => item.isPublished)
                                .map((item, itemIdx) => (
                                  <div key={item._id} className="p-4 hover:bg-[var(--color-bg-secondary)]/30 transition-colors">
                                    <div className="text-xs font-semibold text-[var(--color-text)] mb-2 flex items-start gap-2">
                                      <span className="text-[var(--color-primary)] font-mono text-xs">Q{itemIdx + 1}.</span>
                                      <span>{item.question}</span>
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)] pl-6 pr-4 mb-3 leading-relaxed whitespace-pre-wrap">
                                      <MarkdownRenderer content={item.answer} />
                                    </div>
                                    
                                    {item.tags?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pl-6 mb-3">
                                        {item.tags.map(tag => (
                                          <span key={tag} className="font-mono text-[9px] text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{tag}</span>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)] pl-6 font-mono">
                                      <span className="font-medium text-[var(--color-text-secondary)]/80">Was this helpful?</span>
                                      <button
                                        onClick={() => handleFeedback(faq._id, item._id, true)}
                                        className={`flex items-center gap-1 ${localVotes[item._id] === 'helpful' ? 'text-green-500 font-semibold' : 'hover:text-green-500'}`}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                        <span>Yes ({item.helpfulCount || 0})</span>
                                      </button>
                                      <button
                                        onClick={() => handleFeedback(faq._id, item._id, false)}
                                        className={`flex items-center gap-1 ${localVotes[item._id] === 'notHelpful' ? 'text-red-500 font-semibold' : 'hover:text-red-500'}`}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                                        <span>No ({item.notHelpfulCount || 0})</span>
                                      </button>
                                      
                                      <span className="text-[var(--color-text-muted)]">|</span>
                                      
                                      {/* Report FAQ Item */}
                                      <button
                                        onClick={() => handleReportFAQItem(faq, item)}
                                        className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                                        title="Report question or answer"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                        </svg>
                                        <span>Report</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !user && filteredFAQs.length === 0 && (
              <div className="text-center py-12 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] text-xs">
                No FAQs found in this category.
              </div>
            )}
          </main>
        </div>

        {/* Community Guidelines & Policies Banner */}
        <section className="mt-16 pt-8 border-t border-[var(--color-border)]">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Community Guidelines & Spam Policies</h3>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-3xl pl-10.5">
                To maintain a high-quality Q&A resource, all questions are filtered in real-time by AI spam guards. Please keep posts supportive, pick confidence levels honestly, and tag your questions correctly.
              </p>
            </div>
            <Link href="/guidelines" className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:border-[var(--color-border-subtle)] hover:text-[var(--color-text)] transition-colors rounded-md px-4 py-2 flex items-center gap-1.5 shrink-0">
              Read Guidelines
              <svg className="w-3 h-3 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>


      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-md shadow-xl w-full max-w-md p-6 border border-[var(--color-border)]/50">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">Add New Category</h3>
            <form onSubmit={handleAddCategory}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--color-text)] mb-1.5">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., About the internship"
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--color-border)] rounded-md bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-medium text-[var(--color-text)] mb-1.5">Icon (emoji)</label>
                <input
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="📌"
                  className="w-full px-3.5 py-2.5 text-xs border border-[var(--color-border)] rounded-md bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="btn-primary h-8 text-xs !px-4"
                >
                  {addingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {user && <MascotCompanion />}
    </div>
  );
}
