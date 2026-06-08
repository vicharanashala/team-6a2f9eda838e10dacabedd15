'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('questions');
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [savedFaqs, setSavedFaqs] = useState([]);
  const [meTooQuestions, setMeTooQuestions] = useState([]);
  const [escalatedQuestions, setEscalatedQuestions] = useState([]);
  const [questionTags, setQuestionTags] = useState([]);
  const [faqTags, setFaqTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [questionPagination, setQuestionPagination] = useState(null);
  const [faqPagination, setFaqPagination] = useState(null);
  const [meTooPagination, setMeTooPagination] = useState(null);
  const [escalatedPagination, setEscalatedPagination] = useState(null);
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

  const fetchMeTooQuestions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.get('/users/me/me-too', { page });
      setMeTooQuestions(data.questions || []);
      setMeTooPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load Me Too questions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEscalatedQuestions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api.get('/questions/escalated', { page });
      setEscalatedQuestions(data.questions || []);
      setEscalatedPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load escalated questions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth?mode=login');
      return;
    }
    if (tab === 'questions') {
      fetchSavedQuestions(selectedTag);
    } else if (tab === 'faqs') {
      fetchSavedFaqs(selectedTag);
    } else if (tab === 'me-too') {
      fetchMeTooQuestions();
    } else if (tab === 'escalations') {
      fetchEscalatedQuestions();
    }
    fetchTags();
  }, [user, authLoading, router, tab, selectedTag, fetchSavedQuestions, fetchSavedFaqs, fetchTags, fetchMeTooQuestions, fetchEscalatedQuestions]);

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

  const handleRemoveMeToo = async (questionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.patch(`/questions/${questionId}/me-too`);
      setMeTooQuestions(prev => prev.filter(q => q._id !== questionId));
      toast.success('Removed from Me Too list');
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

  const currentTags = tab === 'me-too' || tab === 'escalations' ? [] : (tab === 'questions' ? questionTags : faqTags);
  const currentSaved = tab === 'me-too' ? meTooQuestions : tab === 'escalations' ? escalatedQuestions : (tab === 'questions' ? savedQuestions : savedFaqs);
  const currentPagination = tab === 'me-too' ? meTooPagination : tab === 'escalations' ? escalatedPagination : (tab === 'questions' ? questionPagination : faqPagination);

  const renderEscalatedItem = (question) => {
    const link = `/questions/${question._id}`;
    const isResolved = question.resolutionStatus === 'resolved';

    return (
      <div key={question._id} className="card-hover p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <Link href={link} className="block">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isResolved 
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {isResolved ? 'Resolved' : 'Escalated'}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Escalated {formatDate(question.escalatedAt || question.createdAt)}
                </span>
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text)] hover:text-primary-600 mb-1">
                {question.title}
              </h3>
              {question.escalationReason && (
                <div className="text-xs text-[var(--color-text-secondary)] italic mt-2 bg-[var(--color-bg-tertiary)]/60 p-2.5 rounded-lg border border-[var(--color-border)]/40">
                  <span className="font-semibold text-[10px] uppercase tracking-wider block text-[var(--color-text-muted)] mb-1">Reason for Escalation:</span>
                  {question.escalationReason}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-2">
                <span>{question.answerCount || 0} answers</span>
                {question.tagNames?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {question.tagNames.map(tag => (
                      <span key={tag} className="badge-gray text-[9px]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  };

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

  const renderMeTooItem = (question) => {
    const link = `/questions/${question._id}`;
    return (
      <div key={question._id} className="card-hover p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <Link href={link} className="block">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-blue text-xs">Me Too</span>
                {question.meTooCount > 1 && (
                  <span className="text-xs text-[var(--color-text-secondary)]">{question.meTooCount} people also</span>
                )}
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text)] hover:text-primary-600 mb-1">
                {question.title}
              </h3>
              {question.body && (
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                  {question.body.slice(0, 200)}
                </p>
              )}
              {question.tagNames?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {question.tagNames.map(tag => (
                    <span key={tag} className="badge-gray text-xs">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                <span>{question.answerCount || 0} answers</span>
                <span>{question.upvotes || 0} votes</span>
                <span>Added {formatDate(question.createdAt)}</span>
              </div>
            </Link>
          </div>
          <button
            onClick={(e) => handleRemoveMeToo(question._id, e)}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Remove from Me Too"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="h-8 bg-[var(--color-border)] rounded w-1/4" />
        <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
        <div className="h-64 bg-[var(--color-border)] rounded-md w-full" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {tab === 'me-too' ? 'Me Too List' : tab === 'escalations' ? 'My Escalations' : 'Saved Items'}
        </h1>
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
        <button
          onClick={() => { setTab('me-too'); setSelectedTag(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'me-too' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Me Too
        </button>
        <button
          onClick={() => { setTab('escalations'); setSelectedTag(''); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'escalations' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          My Escalations
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
          <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
            {tab === 'me-too' ? 'No Me Too questions' : tab === 'escalations' ? 'No escalated doubts' : `No saved ${tab}`}
          </h3>
          <p className="text-[var(--color-text-secondary)]">
            {tab === 'me-too' 
              ? 'Mark questions as "Me Too" to show interest' 
              : tab === 'escalations' 
                ? 'Your escalated questions will show up here.' 
                : `Save ${tab} to reference them later`}
          </p>
          <Link href={tab === 'questions' || tab === 'escalations' ? '/questions' : '/faqs'} className="btn-primary mt-4">
            Browse {tab === 'escalations' ? 'questions' : tab}
          </Link>
        </div>
      ) : tab === 'escalations' ? (
        <div className="space-y-4">
          {escalatedQuestions.map(q => renderEscalatedItem(q))}
        </div>
      ) : tab === 'me-too' ? (
        <div className="space-y-4">
          {meTooQuestions.map(q => renderMeTooItem(q))}
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
              onClick={() => {
                if (tab === 'me-too') fetchMeTooQuestions(i + 1);
                else if (tab === 'escalations') fetchEscalatedQuestions(i + 1);
                else if (tab === 'questions') fetchSavedQuestions(selectedTag, i + 1);
                else fetchSavedFaqs(selectedTag, i + 1);
              }}
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