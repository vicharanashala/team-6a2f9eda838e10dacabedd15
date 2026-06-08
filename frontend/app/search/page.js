'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate, truncate } from '@/lib/utils';
import api from '@/lib/api';
import RecommendedFAQs from '@/components/RecommendedFAQs';

const getSearchResultLink = (result) => {
  const typeLabel = result._type || (result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user');
  if (typeLabel === 'question') {
    return `/questions/${result.id}`;
  } else if (typeLabel === 'faq') {
    if (result.id && result.id.includes('_')) {
      const [faqId, itemId] = result.id.split('_');
      return `/faqs/${result.slug || faqId}#${itemId}`;
    }
    return `/faqs/${result.slug || result.faqId || result.id}`;
  } else {
    return `/users/${result.username}`;
  }
};

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rawQ = searchParams.get('q') || '';
    const t = searchParams.get('type') || '';
    const sanitized = rawQ.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
    setQuery(sanitized);
    setType(t);
    if (sanitized) {
      performSearch(sanitized, t);
    } else {
      setResults([]);
      setTotal(0);
    }
    api.get('/search/suggestions').then(d => setSuggestions(d.suggestions || [])).catch(() => {});
  }, [searchParams]);

  const performSearch = async (q, t) => {
    const sanitized = q.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
    if (!sanitized) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get('/search', { q: sanitized, type: t });
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const sanitized = query.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
    setQuery(sanitized);
    if (sanitized) {
      router.push(`/search?q=${encodeURIComponent(sanitized)}${type ? `&type=${type}` : ''}`);
    } else {
      router.push('/search');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">Search</span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">Find questions, FAQs, and community members</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, FAQs, users..."
            className="w-full px-4 py-3 pl-12 border border-[var(--color-border)]/60 rounded-xl text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text)] dark:text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
            autoFocus
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </form>

      {/* Type filter */}
      <div className="flex gap-2 mb-6">
        {['', 'questions', 'faqs', 'users'].map(t => (
          <button
            key={t}
            onClick={() => {
              setType(t);
              const sanitized = query.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
              if (sanitized) {
                router.push(`/search?q=${encodeURIComponent(sanitized)}&type=${t}`);
              } else {
                router.push(t ? `/search?type=${t}` : '/search');
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              type === t
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      {/* Suggestions */}
      {!query && suggestions.length > 0 && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">Trending searches</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <Link
                key={i}
                href={`/search?q=${encodeURIComponent(s.query)}`}
                className="badge-gray hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                {s.query}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!query && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">💡</span>
            <h3 className="text-base font-bold text-[var(--color-text)] bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">Recommended FAQs</h3>
          </div>
          <RecommendedFAQs limit={5} layout="grid" />
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/40 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-[var(--color-border)] rounded w-3/4 mb-3" />
              <div className="h-4 bg-[var(--color-border)] rounded w-full mb-2" />
              <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : results.length === 0 && query ? (
        <div className="space-y-8">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/60 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">No results found for "{query}"</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">It seems this question or topic is new to the platform.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`/questions/ask?title=${encodeURIComponent(query)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-[var(--color-primary)] text-white rounded-xl hover:opacity-90 shadow-md shadow-[var(--color-primary)]/10 hover:shadow-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Do you want to ask a question?
              </Link>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">or</span>
              <Link
                href={`/faqs?add=true`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-primary)]/30 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Create a new FAQ?
              </Link>
            </div>
          </div>

          <div className="p-6 bg-[var(--color-bg-secondary)]/30 border border-[var(--color-border)]/40 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💡</span>
              <h3 className="text-base font-bold text-[var(--color-text)] bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">You might find these helpful</h3>
            </div>
            <RecommendedFAQs limit={5} layout="grid" />
          </div>
        </div>
      ) : (
        <>
          {total > 0 && <p className="text-sm text-[var(--color-text-secondary)] mb-4">{total} results found</p>}
          <div className="space-y-4">
            {results.map((result) => {
              const typeLabel = result._type || (result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user');
              const title = result.title || result.question || result.faqTitle || result.displayName || result.username || 'Untitled';
              const desc = result.body || result.description || result.answer || result.bio || '';
              const link = getSearchResultLink(result);

              return (
                <Link key={result.id} href={link} className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-md border border-[var(--color-border)]/60 rounded-2xl p-5 block transition-all duration-300 hover:shadow-lg hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-gray text-xs capitalize">{typeLabel}</span>
                    {result.score && <span className="text-xs text-[var(--color-text-secondary)]">Relevance: {Math.round(result.score * 100)}%</span>}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] mb-1">{title}</h3>
                  {desc && <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{truncate(desc, 200)}</p>}
                  {result.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="badge-primary text-xs">{tag}</span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8 animate-pulse"><div className="h-8 w-48 bg-[var(--color-border)] rounded mb-6" /></div>}>
      <SearchPageContent />
    </Suspense>
  );
}
