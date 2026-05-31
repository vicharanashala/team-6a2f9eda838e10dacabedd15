'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate, truncate } from '@/lib/utils';
import api from '@/lib/api';

export default function SearchModal({ isOpen, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await api.get('/search', { q: query, type });
        setResults(data.results || []);
        setSelectedIndex(-1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 200);
    return () => clearTimeout(debounce);
  }, [query, type]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        const result = results[selectedIndex];
        const typeLabel = result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user';
        const link = typeLabel === 'question' ? `/questions/${result.id}` : typeLabel === 'faq' ? `/faqs/${result.slug || result.id}` : `/users/${result.username}`;
        router.push(link);
        onClose();
      } else if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}`);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'j') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'k') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    }
  }, [results, selectedIndex, query, type, router, onClose]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleResultClick = (result) => {
    const typeLabel = result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user';
    const link = typeLabel === 'question' ? `/questions/${result.id}` : typeLabel === 'faq' ? `/faqs/${result.slug || result.id}` : `/users/${result.username}`;
    router.push(link);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 pt-20 pb-8 flex items-start justify-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className="relative bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search questions, FAQs, users..."
                className="flex-1 text-lg outline-none bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-secondary)]"
              />
              {loading && (
                <svg className="animate-spin w-5 h-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd>
            </div>
            <div className="flex gap-2 mt-3">
              {['', 'questions', 'faqs', 'users'].map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1 text-sm rounded-lg font-medium transition-colors ${
                    type === t ? 'bg-primary-600 text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {t || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div ref={resultsRef} className="max-h-96 overflow-y-auto">
            {results.length > 0 ? (
              <ul className="py-2">
                {results.map((result, index) => {
                  const typeLabel = result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user';
                  const title = result.title || result.displayName || result.username || 'Untitled';
                  const desc = result.body || result.description || result.bio || '';
                  const link = typeLabel === 'question' ? `/questions/${result.id}` : typeLabel === 'faq' ? `/faqs/${result.slug || result.id}` : `/users/${result.username}`;

                  return (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          selectedIndex === index ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg)]'
                        }`}
                      >
                        <span className="badge-gray text-xs capitalize mt-1 shrink-0">{typeLabel}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-[var(--color-text)] truncate">{title}</h4>
                          {desc && <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">{truncate(desc, 100)}</p>}
                          {result.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {result.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="badge-primary text-xs">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedIndex === index && (
                          <span className="text-xs text-[var(--color-text-secondary)] shrink-0">Enter to select</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : query.trim() && !loading ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-sm">No results found for "{query}"</p>
                <p className="text-[var(--color-text-secondary)] text-xs mt-1 opacity-60">Press Enter to search all pages</p>
              </div>
            ) : !query.trim() ? (
              <div className="py-8 text-center">
                <p className="text-[var(--color-text-secondary)] text-sm">Type to search...</p>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-[var(--color-text-secondary)]">
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑</kbd><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded ml-1">↓</kbd> navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd> select</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> close</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
