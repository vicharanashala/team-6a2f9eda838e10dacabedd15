'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import SimpleEditor from '@/components/SimpleEditor';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import RecommendedFAQs from '@/components/RecommendedFAQs';

export default function FAQDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [faq, setFaq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [localVotes, setLocalVotes] = useState({});
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [addingQuestion, setAddingQuestion] = useState(false);

  useEffect(() => {
    api.get(`/faqs/${slug}`)
      .then(data => {
        setFaq(data.faq);
        const votes = {};
        data.faq.items.forEach(item => {
          if (item.userVote) votes[item._id] = item.userVote;
        });
        setLocalVotes(votes);
      })
      .catch(() => toast.error('FAQ not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  const checkIfSaved = async () => {
    if (!user || !faq) return;
    try {
      const data = await api.get('/users/me/saved/faqs');
      const saved = data.saved?.some(s => s.faq?._id === faq._id);
      setIsSaved(saved);
    } catch (_) {}
  };

  useEffect(() => {
    checkIfSaved();
  }, [user, faq]);

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined' && window.location.hash && faq) {
        const hashId = window.location.hash.substring(1);
        const index = faq.items.findIndex(item => item._id === hashId);
        if (index !== -1) {
          setActiveItem(index);
          setTimeout(() => {
            const element = document.getElementById(hashId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (faq) {
      handleHashChange();
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [faq]);

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'moderator');

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setAddingQuestion(true);
    try {
      const data = await api.post(`/faqs/${faq._id}/items`, {
        question: newQuestion.trim(),
        answer: newAnswer,
      });
      setFaq(data.faq);
      setShowAddQuestion(false);
      setNewQuestion('');
      setNewAnswer('');
      toast.success('Question added successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleSave = async () => {
    if (!user) { toast.error('Please login to save'); return; }
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
    }
  };

  const handleFeedback = async (itemId, helpful) => {
    if (!user) { toast.error('Please login to vote'); return; }
    const currentVote = localVotes[itemId];
    const isUndo = currentVote === (helpful ? 'helpful' : 'notHelpful');
    try {
      const data = await api.post(`/faqs/${faq._id}/items/${itemId}/feedback`, { helpful, undo: isUndo });
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
      setFaq(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item._id === itemId
            ? { ...item, helpfulCount: data.helpfulCount, notHelpfulCount: data.notHelpfulCount }
            : item
        )
      }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [openItems, setOpenItems] = useState({ 0: true });

  const toggleItem = (index) => {
    setOpenItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!faq) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">FAQ not found</h2>
      <Link href="/faqs" className="text-primary-600 hover:text-primary-700">Browse all FAQs</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-3">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href="/faqs" className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">&larr; Back to FAQs</Link>
                <div className="flex items-center gap-2 mt-2 mb-2">
                  {faq.isOfficial && <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">Official</span>}
                  {faq.category && <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 capitalize font-mono">{faq.category}</span>}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight">{faq.title}</h1>
                {faq.description && <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">{faq.description}</p>}
              </div>
              <div className="flex gap-2">
                {isAdminOrMod && (
                  <button onClick={() => setShowAddQuestion(true)} className="btn-secondary btn-sm h-7 !px-2.5 !py-1 text-xs shrink-0">
                    + Add Question
                  </button>
                )}
                <button onClick={handleSave} className="btn-secondary btn-sm h-7 !px-2.5 !py-1 text-xs shrink-0">
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar navigation */}
          {faq.items?.length > 1 && (
            <div className="bg-[var(--color-bg-secondary)] rounded-md border border-[var(--color-border)] p-4 mb-6">
              <h3 className="text-xs font-semibold text-[var(--color-text)] mb-2 font-mono uppercase tracking-wider">On this page</h3>
              <nav className="space-y-1">
                {faq.items.filter(i => i.isPublished).map((item, index) => (
                  <button
                    key={item._id}
                    onClick={() => {
                      setActiveItem(index);
                      setOpenItems(prev => ({ ...prev, [index]: true }));
                      document.getElementById(item._id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                      activeItem === index ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    {item.question}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* FAQ items Accordion */}
          <div className="flex flex-col gap-3">
            {(faq.items || []).filter(i => i.isPublished).map((item, index) => {
              const isOpen = !!openItems[index];
              const displayIndex = String(index + 1).padStart(2, '0');
              return (
                <div
                  key={item._id}
                  id={item._id}
                  style={{ scrollMarginTop: '100px' }}
                  className={`bg-[var(--color-bg-secondary)] border rounded-md overflow-hidden transition-all duration-200 ${
                    isOpen ? 'border-[var(--color-primary)]/50' : 'border-[var(--color-border)] hover:border-[var(--color-border-subtle)]'
                  }`}
                >
                  {/* Trigger Header */}
                  <div
                    onClick={() => toggleItem(index)}
                    className="flex items-start justify-between gap-4 p-4 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)] mt-1">{displayIndex}</span>
                      <span className="text-xs font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors leading-relaxed">{item.question}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.tags?.length > 0 && (
                        <span className="text-[10px] font-mono text-[var(--color-primary)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-md hidden sm:inline capitalize">
                          {item.tags[0]}
                        </span>
                      )}
                      <svg
                        className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Body Content with smooth height transition */}
                  <div className={`faq-body-wrap ${isOpen ? 'faq-body-wrap-open' : ''}`}>
                    <div className="faq-body-inner">
                      <div className="p-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-bg)]/30">
                        <MarkdownRenderer content={item.answer} />
                        
                        {item.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {item.tags.map(tag => (
                              <span key={tag} className="font-mono text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-mono">
                          <span>Was this helpful?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFeedback(item._id, true); }}
                            className={`flex items-center gap-1 ${localVotes[item._id] === 'helpful' ? 'text-green-500 font-semibold' : 'hover:text-green-500'}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                            Yes ({item.helpfulCount || 0})
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFeedback(item._id, false); }}
                            className={`flex items-center gap-1 ${localVotes[item._id] === 'notHelpful' ? 'text-red-500 font-semibold' : 'hover:text-red-500'}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                            No ({item.notHelpfulCount || 0})
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {faq.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {faq.tags.map(tag => (
                <Link key={tag} href={`/tags/${tag}`} className="badge-primary">{tag}</Link>
              ))}
            </div>
          )}

          <div className="mt-6 text-xs text-[var(--color-text-secondary)]">
            {faq.viewCount} views &middot; Last updated {formatDate(faq.updatedAt)}
          </div>
        </div>

        {/* Sidebar recommendations */}
        <aside className="lg:col-span-1 lg:sticky lg:top-24 space-y-6">
          <div className="p-5 bg-[var(--color-bg-secondary)]/60 backdrop-blur-md rounded-2xl border border-[var(--color-border)]/50 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-3 bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">💡 Recommended</h3>
            <RecommendedFAQs limit={4} layout="sidebar" />
          </div>
        </aside>
      </div>

      {showAddQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddQuestion(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Add Question to {faq.title}</h3>
            <form onSubmit={handleAddQuestion}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter the question"
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Answer</label>
                <SimpleEditor
                  content={newAnswer}
                  onChange={setNewAnswer}
                  placeholder="Write the answer (Markdown supported)..."
                  minHeight="200px"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddQuestion(false)}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingQuestion || !newQuestion.trim() || !newAnswer.trim()}
                  className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {addingQuestion ? 'Adding...' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
