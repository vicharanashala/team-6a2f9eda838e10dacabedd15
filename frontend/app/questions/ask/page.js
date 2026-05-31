'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DRAFT_KEY = 'question_draft';
const DRAFT_TAGS_KEY = 'question_draft_tags';

export default function AskQuestionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', body: '', tagInput: '', anonymous: false });
  const [tags, setTags] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [similarQuestions, setSimilarQuestions] = useState([]);
  const [alreadyAskedInfo, setAlreadyAskedInfo] = useState(null);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth?mode=login');
      return;
    }
    const savedTitle = localStorage.getItem(DRAFT_KEY);
    const savedTags = localStorage.getItem(DRAFT_TAGS_KEY);
    if (savedTitle) setForm(f => ({ ...f, title: savedTitle }));
    if (savedTags) setTags(JSON.parse(savedTags));
    api.get('/tags').then(d => setTagSuggestions(d.tags || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!form.title && !form.body) return;
    setHasUnsavedChanges(true);
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, form.title);
      localStorage.setItem(DRAFT_TAGS_KEY, JSON.stringify(tags));
      setDraftSaved(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [form.title, form.body, tags]);

  const findSimilar = useCallback(async (title, currentTags) => {
    if (!title || title.length < 5) {
      setSimilarQuestions([]);
      return;
    }
    try {
      const data = await api.get('/questions/similar', { title, tags: currentTags.join(',') });
      setSimilarQuestions(data.similar || []);
    } catch (_) {}
  }, []);

  const searchTitleSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setTitleSuggestions([]);
      setShowTitleSuggestions(false);
      return;
    }
    try {
      const data = await api.get('/questions/similar', { title: query });
      const suggestions = (data.similar || []).concat(data.duplicates || []).slice(0, 5);
      setTitleSuggestions(suggestions);
      setShowTitleSuggestions(suggestions.length > 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      findSimilar(form.title, tags);
      searchTitleSuggestions(form.title);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.title, tags, findSimilar, searchTitleSuggestions]);

  useEffect(() => {
    const handleClickOutside = () => setShowTitleSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const addTag = (name) => {
    const t = name.toLowerCase().trim();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
    }
    setForm({ ...form, tagInput: '' });
  };

  const removeTag = (name) => setTags(tags.filter(t => t !== name));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.title.length < 10) { setError('Title must be at least 10 characters'); return; }
    if (form.body.replace(/<[^>]*>/g, '').length < 20) { setError('Body must be at least 20 characters'); return; }

    setLoading(true);
    try {
      const data = await api.post('/questions', { title: form.title, body: form.body, tags, anonymous: form.anonymous });
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_TAGS_KEY);
      if (data.alreadyAsked) {
        setAlreadyAskedInfo(data.alreadyAsked);
        toast.success('Question posted and flagged as already asked');
      } else {
        toast.success('Question posted!');
      }
      router.push(`/questions/${data.question._id}`);
    } catch (err) {
      setError(err.message || 'Failed to post question');
      toast.error(err.message || 'Failed to post question');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">Ask a Question</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <div className="relative">
            <label className="label">Title</label>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Be specific and imagine you&apos;re asking a question to another person.</p>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); setShowTitleSuggestions(true); }}
              onFocus={() => form.title.length >= 3 && titleSuggestions.length > 0 && setShowTitleSuggestions(true)}
              className="input"
              placeholder="e.g. How do I use useEffect in React for data fetching?"
              maxLength={300}
            />
            {showTitleSuggestions && titleSuggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="px-3 py-2 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Suggestions</div>
                {titleSuggestions.map(q => (
                  <button
                    key={q._id}
                    type="button"
                    onClick={() => { setForm({ ...form, title: q.title }); setShowTitleSuggestions(false); }}
                    className="w-full px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex flex-col gap-0.5"
                  >
                    <span className="text-[var(--color-text)] font-medium line-clamp-1">{q.title}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{q.answerCount || 0} answers</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Similar Questions Warning */}
          {similarQuestions.length > 0 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">Similar questions already exist!</span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">Check if your question has already been answered:</p>
              <ul className="space-y-1">
                {similarQuestions.slice(0, 3).map(q => (
                  <li key={q._id}>
                    <Link href={`/questions/${q._id}`} target="_blank" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <span>{q.title}</span>
                      <span className="text-[var(--color-text-secondary)]">({q.answerCount} answers)</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already Asked Info */}
          {alreadyAskedInfo && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">This question has been flagged as already asked!</span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                Match type: <span className="font-medium">{alreadyAskedInfo.scopeMatch}</span> — Your question is linked to a related existing question.
              </p>
              <Link href={`/questions/${alreadyAskedInfo.matchedQuestion._id}`} target="_blank" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <span>{alreadyAskedInfo.matchedQuestion.title}</span>
                <span className="text-[var(--color-text-secondary)]">({alreadyAskedInfo.matchedQuestion.answerCount} answers)</span>
              </Link>
            </div>
          )}

          <div>
            <label className="label">Body</label>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Include all the information someone would need to answer your question.</p>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="input min-h-[200px]"
              placeholder="Describe your problem in detail..."
            />
          </div>

          <div>
            <label className="label">Tags</label>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">Add up to 5 tags to describe what your question is about.</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span key={tag} className="badge-primary flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-primary-600 hover:text-primary-800">&times;</button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={form.tagInput}
                onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(form.tagInput); } }}
                className="input"
                placeholder="Type and press Enter to add tags"
              />
              {form.tagInput && tagSuggestions.filter(s => s.name.includes(form.tagInput.toLowerCase()) && !tags.includes(s.name)).length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {tagSuggestions.filter(s => s.name.includes(form.tagInput.toLowerCase()) && !tags.includes(s.name)).slice(0, 5).map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => addTag(s.name)}
                      className="w-full px-3 py-2 text-sm text-left text-[var(--color-text)] hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-[var(--color-border)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.anonymous}
                onChange={(e) => setForm({ ...form, anonymous: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-[var(--color-text)]">Ask anonymously</span>
                <p className="text-xs text-[var(--color-text-secondary)]">Your name will be shown as "Anonymous Student"</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {draftSaved && <span className="text-xs text-green-600">Draft saved</span>}
          {hasUnsavedChanges && !draftSaved && <span className="text-xs text-[var(--color-text-secondary)]">Saving...</span>}
          <button type="submit" disabled={loading} className="btn-primary px-6 py-2.5">
            {loading ? 'Posting...' : 'Post Your Question'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary px-6 py-2.5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}