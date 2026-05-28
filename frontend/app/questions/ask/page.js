'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AskQuestionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: '', body: '', tagInput: '' });
  const [tags, setTags] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [similarQuestions, setSimilarQuestions] = useState([]);
  const [alreadyAskedInfo, setAlreadyAskedInfo] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth?mode=login');
      return;
    }
    api.get('/tags').then(d => setTagSuggestions(d.tags || [])).catch(() => {});
  }, [user]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      findSimilar(form.title, tags);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.title, tags, findSimilar]);

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
      const data = await api.post('/questions', { title: form.title, body: form.body, tags });
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ask a Question</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <div>
            <label className="label">Title</label>
            <p className="text-xs text-gray-500 mb-1">Be specific and imagine you&apos;re asking a question to another person.</p>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="e.g. How do I use useEffect in React for data fetching?"
              maxLength={300}
            />
          </div>

          {/* Similar Questions Warning */}
          {similarQuestions.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-semibold">Similar questions already exist!</span>
              </div>
              <p className="text-xs text-yellow-700 mb-2">Check if your question has already been answered:</p>
              <ul className="space-y-1">
                {similarQuestions.slice(0, 3).map(q => (
                  <li key={q._id}>
                    <Link href={`/questions/${q._id}`} target="_blank" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      <span>{q.title}</span>
                      <span className="text-gray-400">({q.answerCount} answers)</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already Asked Info */}
          {alreadyAskedInfo && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">This question has been flagged as already asked!</span>
              </div>
              <p className="text-xs text-blue-700 mb-2">
                Match type: <span className="font-medium">{alreadyAskedInfo.scopeMatch}</span> — Your question is linked to a related existing question.
              </p>
              <Link href={`/questions/${alreadyAskedInfo.matchedQuestion._id}`} target="_blank" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <span>{alreadyAskedInfo.matchedQuestion.title}</span>
                <span className="text-gray-400">({alreadyAskedInfo.matchedQuestion.answerCount} answers)</span>
              </Link>
            </div>
          )}

          <div>
            <label className="label">Body</label>
            <p className="text-xs text-gray-500 mb-1">Include all the information someone would need to answer your question.</p>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="input min-h-[200px]"
              placeholder="Describe your problem in detail..."
            />
          </div>

          <div>
            <label className="label">Tags</label>
            <p className="text-xs text-gray-500 mb-1">Add up to 5 tags to describe what your question is about.</p>
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
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {tagSuggestions.filter(s => s.name.includes(form.tagInput.toLowerCase()) && !tags.includes(s.name)).slice(0, 5).map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => addTag(s.name)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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