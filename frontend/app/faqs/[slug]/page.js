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
    if (currentVote === (helpful ? 'helpful' : 'notHelpful')) {
      toast.error('You have already voted');
      return;
    }
    try {
      const data = await api.post(`/faqs/${faq._id}/items/${itemId}/feedback`, { helpful });
      setLocalVotes(prev => ({ ...prev, [itemId]: helpful ? 'helpful' : 'notHelpful' }));
      setFaq(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item._id === itemId
            ? { ...item, helpfulCount: data.helpfulCount, notHelpfulCount: data.notHelpfulCount }
            : item
        )
      }));
      toast.success(helpful ? 'Glad this helped!' : 'Thanks for the feedback');
    } catch (err) {
      toast.error(err.message);
    }
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/faqs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">&larr; Back to FAQs</Link>
            <div className="flex items-center gap-2 mt-2 mb-2">
              {faq.isOfficial && <span className="badge-green">Official</span>}
              {faq.category && <span className="badge-gray capitalize">{faq.category}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{faq.title}</h1>
            {faq.description && <p className="text-[var(--color-text-secondary)] mt-2">{faq.description}</p>}
          </div>
          <div className="flex gap-2">
            {isAdminOrMod && (
              <button onClick={() => setShowAddQuestion(true)} className="btn-secondary btn-sm shrink-0">
                + Add Question
              </button>
            )}
            <button onClick={handleSave} className="btn-secondary btn-sm shrink-0">
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar navigation */}
      {faq.items?.length > 1 && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">On this page</h3>
          <nav className="space-y-1">
            {faq.items.filter(i => i.isPublished).map((item, index) => (
              <button
                key={item._id}
                onClick={() => {
                  setActiveItem(index);
                  document.getElementById(`item-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeItem === index ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'text-[var(--color-text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {item.question}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* FAQ items */}
      <div className="space-y-6">
        {(faq.items || []).filter(i => i.isPublished).map((item, index) => (
          <div
            key={item._id}
            id={`item-${index}`}
            className={`card p-6 transition-all ${activeItem === index ? 'ring-2 ring-primary-200' : ''}`}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">{item.question}</h2>
            <MarkdownRenderer content={item.answer} />
            {item.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {item.tags.map(tag => (
                  <span key={tag} className="badge-gray text-xs">{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              <span>Was this helpful?</span>
              <button
                onClick={() => handleFeedback(item._id, true)}
                className={`flex items-center gap-1 ${localVotes[item._id] === 'helpful' ? 'text-green-600 font-semibold' : 'hover:text-green-600'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                Yes ({item.helpfulCount || 0})
              </button>
              <button
                onClick={() => handleFeedback(item._id, false)}
                className={`flex items-center gap-1 ${localVotes[item._id] === 'notHelpful' ? 'text-red-600 font-semibold' : 'hover:text-red-600'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                No ({item.notHelpfulCount || 0})
              </button>
            </div>
          </div>
        ))}
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
