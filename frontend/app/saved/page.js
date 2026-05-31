'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SavedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('questions');
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [savedFaqs, setSavedFaqs] = useState([]);
  const [questionTags, setQuestionTags] = useState([]);
  const [faqTags, setFaqTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [questionPagination, setQuestionPagination] = useState(null);
  const [faqPagination, setFaqPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');

  const fetchSavedQuestions = useCallback(async (tag = '', page = 1) => {
    setLoading(true);
    try {
      const params = { page };
      if (tag) params.tag = tag;
      const data = await api.get('/users/me/saved', params);
      setSavedQuestions(data.saved || []);
      setQuestionPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load saved questions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSavedFaqs = useCallback(async (tag = '', page = 1) => {
    setLoading(true);
    try {
      const params = { page };
      if (tag) params.tag = tag;
      const data = await api.get('/users/me/saved/faqs', params);
      setSavedFaqs(data.saved || []);
      setFaqPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load saved FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const [qTags, fTags] = await Promise.all([
        api.get('/users/me/saved/tags'),
        api.get('/users/me/saved/faqs/tags'),
      ]);
      setQuestionTags(qTags.tags || []);
      setFaqTags(fTags.tags || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/auth?mode=login');
      return;
    }
    if (tab === 'questions') {
      fetchSavedQuestions(selectedTag);
    } else {
      fetchSavedFaqs(selectedTag);
    }
    fetchTags();
  }, [user, router, tab, selectedTag, fetchSavedQuestions, fetchSavedFaqs, fetchTags]);

  const handleUnsaveQuestion = async (questionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.delete(`/users/me/saved/${questionId}`);
      setSavedQuestions(prev => prev.filter(s => s.question?._id !== questionId));
      toast.success('Question removed from saved');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnsaveFAQ = async (faqId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.delete(`/users/me/saved/faqs/${faqId}`);
      setSavedFaqs(prev => prev.filter(s => s.faq?._id !== faqId));
      toast.success('FAQ removed from saved');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEdit = (savedItem, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(savedItem._id);
    setEditNotes(savedItem.notes || '');
    setEditTags((savedItem.tags || []).join(', '));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNotes('');
    setEditTags('');
  };

  const saveQuestionEdit = async (savedId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await api.patch(`/users/me/saved/${savedId}`, { notes: editNotes, tags });
      setSavedQuestions(prev => prev.map(s => s._id === savedId ? { ...s, notes: editNotes, tags } : s));
      cancelEdit();
      fetchTags();
      toast.success('Saved question updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveFAQEdit = async (savedId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await api.patch(`/users/me/saved/faqs/${savedId}`, { notes: editNotes, tags });
      setSavedFaqs(prev => prev.map(s => s._id === savedId ? { ...s, notes: editNotes, tags } : s));
      cancelEdit();
      fetchTags();
      toast.success('Saved FAQ updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const currentTags = tab === 'questions' ? questionTags : faqTags;
  const currentSaved = tab === 'questions' ? savedQuestions : savedFaqs;
  const currentPagination = tab === 'questions' ? questionPagination : faqPagination;

  const renderSavedItem = (item, isFAQ) => {
    const target = isFAQ ? item.faq : item.question;
    const link = isFAQ ? `/faqs/${target?.slug}` : `/questions/${target?._id}`;
    const typeLabel = isFAQ ? 'FAQ' : 'question';

    return (
      <div key={item._id} className="card-hover p-4 sm:p-6">
        {editingId === item._id ? (
          <form onSubmit={(e) => isFAQ ? saveFAQEdit(item._id, e) : saveQuestionEdit(item._id, e)} className="space-y-3">
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Personal notes (optional)"
              className="input w-full"
              maxLength={500}
            />
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="Tags (comma-separated, e.g. important, javascript)"
              className="input w-full"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm">Save</button>
              <button type="button" onClick={cancelEdit} className="btn-secondary btn-sm">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <Link href={link} className="block">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-gray text-xs">{typeLabel}</span>
                    {isFAQ && target?.isOfficial && <span className="badge-green text-xs">Official</span>}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] hover:text-primary-600 mb-1">
                    {target?.title || target?.question || 'Untitled'}
                  </h3>
                   {!isFAQ && target?.body && (
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                      {target.body.slice(0, 200)}
                    </p>
                  )}
                  {isFAQ && target?.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                      {target.description}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-sm italic text-[var(--color-text-secondary)] mb-2">Note: {item.notes}</p>
                  )}
                  {item.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.map(tag => (
                        <span key={tag} className="badge-gray text-xs capitalize">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                    {!isFAQ && <span>{target?.answerCount || 0} answers</span>}
                    {!isFAQ && <span>{target?.upvotes || 0} votes</span>}
                    {isFAQ && <span>{target?.viewCount || 0} views</span>}
                    <span>Saved {formatDate(item.createdAt)}</span>
                  </div>
                </Link>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={(e) => startEdit(item, e)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => isFAQ ? handleUnsaveFAQ(target?._id, e) : handleUnsaveQuestion(target?._id, e)}
                  className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Saved</h1>
        <Link href="/questions" className="btn-secondary btn-sm">Browse Questions</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        <button
          onClick={() => { setTab('questions'); setSelectedTag(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'questions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Questions
        </button>
        <button
          onClick={() => { setTab('faqs'); setSelectedTag(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'faqs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          FAQs
        </button>
      </div>

      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTag('')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              !selectedTag ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {currentTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${
                selectedTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-[var(--color-border)] rounded w-3/4 mb-3" />
              <div className="h-4 bg-[var(--color-border)] rounded w-full mb-2" />
              <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : currentSaved.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">No saved {tab}</h3>
          <p className="text-[var(--color-text-secondary)]">Save {tab} to reference them later</p>
          <Link href={tab === 'questions' ? '/questions' : '/faqs'} className="btn-primary mt-4">Browse {tab}</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {currentSaved.map(item => renderSavedItem(item, tab === 'faqs'))}
        </div>
      )}

      {currentPagination && currentPagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: currentPagination.totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => tab === 'questions' ? fetchSavedQuestions(selectedTag, i + 1) : fetchSavedFaqs(selectedTag, i + 1)}
              className={`px-3 py-1 text-sm rounded ${
                currentPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}