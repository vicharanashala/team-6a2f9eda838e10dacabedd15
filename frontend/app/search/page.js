'use client';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
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

  // Derive state directly from URL params — single source of truth
  const urlQuery = searchParams.get('q') || '';
  const urlType = searchParams.get('type') || '';

  const [inputValue, setInputValue] = useState(urlQuery);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Keep inputValue in sync with URL when URL changes externally (e.g. Navbar search)
  useEffect(() => {
    setInputValue(urlQuery);
  }, [urlQuery]);

  // Main search effect — fires whenever URL query or type changes
  useEffect(() => {
    const sanitized = urlQuery.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");

    if (!sanitized) {
      setResults([]);
      setTotal(0);
      setAiResponse(null);
      setLoading(false);
      setAiLoading(false);
      return;
    }

    // Immediately clear stale results and show loading
    setResults([]);
    setTotal(0);
    setAiResponse(null);
    setLoading(true);
    setAiLoading(true);

    // Use AbortController to cancel in-flight requests when query changes
    const abortController = new AbortController();

    // --- Regular search ---
    const doSearch = async () => {
      try {
        const data = await api.get('/search', { q: sanitized, type: urlType });
        if (!abortController.signal.aborted) {
          setResults(data.results || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Search error:', err);
          setResults([]);
          setTotal(0);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // --- AI search ---
    const doAiSearch = async () => {
      try {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const pageTitle = typeof document !== 'undefined' ? document.title : '';
        const data = await api.get('/search/ai', { q: sanitized, currentUrl, pageTitle });
        if (!abortController.signal.aborted) {
          setAiResponse(data);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('AI search error:', err);
          setAiResponse(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setAiLoading(false);
        }
      }
    };

    const isOffline = typeof window !== 'undefined' && !navigator.onLine;

    doSearch();

    if (isOffline) {
      setAiLoading(false);
      setAiResponse({
        status: 'Offline',
        answer: 'Namaste! PrashnaSārathi AI Assistant is currently offline. Showing local search results from cache instead.',
        source: 'Local Cache'
      });
    } else {
      doAiSearch();
    }

    // Load suggestions in background if online
    if (!isOffline) {
      api.get('/search/suggestions').then(d => setSuggestions(d.suggestions || [])).catch(() => {});
    }

    // Cleanup: abort both requests if the query changes before they finish
    return () => {
      abortController.abort();
    };
  }, [urlQuery, urlType]); // Only depends on URL params — no stale closures possible

  const handleSubmit = (e) => {
    e.preventDefault();
    const sanitized = inputValue.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
    if (sanitized) {
      // Always reset type filter to 'All' on new search submission
      router.push(`/search?q=${encodeURIComponent(sanitized)}`);
    } else {
      router.push('/search');
    }
  };

  const handleTypeFilter = (t) => {
    const sanitized = inputValue.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
    if (sanitized) {
      router.push(`/search?q=${encodeURIComponent(sanitized)}${t ? `&type=${t}` : ''}`);
    } else {
      router.push(t ? `/search?type=${t}` : '/search');
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search questions, FAQs, users..."
            className="w-full px-4 py-3 pl-12 border border-[var(--color-border)]/60 rounded-xl text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text)] dark:text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
            autoFocus
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {loading && (
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      </form>

      {/* Type filter */}
      <div className="flex gap-2 mb-6">
        {['', 'questions', 'faqs', 'users'].map(t => (
          <button
            key={t}
            onClick={() => handleTypeFilter(t)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              urlType === t
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      {/* Suggestions (only when no query) */}
      {!urlQuery && suggestions.length > 0 && (
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

      {!urlQuery && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">💡</span>
            <h3 className="text-base font-bold text-[var(--color-text)] bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">Recommended FAQs</h3>
          </div>
          <RecommendedFAQs limit={5} layout="grid" />
        </div>
      )}

      {/* AI Assistive Answer Panel */}
      {urlQuery && (aiLoading || aiResponse) && (
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/10 via-[var(--color-bg-secondary)] to-indigo-900/10 p-6 shadow-xl shadow-purple-500/5 backdrop-blur-md">
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-purple-500/10 blur-xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/40 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-md">
                  <span className="text-sm">🤖</span>
                  {aiLoading && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text)] tracking-wide">PrashnaSārathi AI Assistant</h2>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {aiLoading ? 'Searching knowledge base...' : 'Assisted Search & Knowledge Synthesis'}
                  </p>
                </div>
              </div>
              
              {!aiLoading && aiResponse?.status && (
                <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  aiResponse.status.toLowerCase().includes('success')
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : aiResponse.status === 'blocked'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {aiResponse.status}
                </span>
              )}
            </div>

            {aiLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-[var(--color-border)]/60 rounded w-1/4" />
                <div className="h-4 bg-[var(--color-border)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--color-border)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--color-border)]/60 rounded w-5/6" />
              </div>
            ) : aiResponse ? (
              <div className="space-y-4">
                {aiResponse.status === 'blocked' ? (
                  <div className="text-sm text-rose-500 dark:text-rose-400 font-medium">
                    ⚠️ {aiResponse.message || 'Please use respectful and appropriate language.'}
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                      {aiResponse.answer || aiResponse.message || 'No information found for this query.'}
                    </div>
                    
                    {aiResponse.source && (
                      <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] font-medium">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]/50">Source: {aiResponse.source}</span>
                      </div>
                    )}

                    {aiResponse.relatedTopics?.length > 0 && (
                      <div className="border-t border-[var(--color-border)]/30 pt-4 mt-2">
                        <h4 className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Related Topics</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResponse.relatedTopics.map((topic, i) => (
                            <button
                              key={i}
                              onClick={() => router.push(`/search?q=${encodeURIComponent(topic)}`)}
                              className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all cursor-pointer font-medium"
                            >
                              🔍 {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Regular Search Results */}
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
      ) : results.length === 0 && urlQuery ? (
        <div className="space-y-8">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/60 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">No results found for "{urlQuery}"</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8">It seems this question or topic is new to the platform.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`/questions/ask?title=${encodeURIComponent(urlQuery)}`}
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
