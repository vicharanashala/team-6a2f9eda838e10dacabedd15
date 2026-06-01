'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/tags', { search })
      .then(data => setTags(data.tags || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">
            Tags
          </span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">Browse questions by topic or category</p>
      </div>

      {/* Filter Input */}
      <div className="mb-8 max-w-md">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tags..."
            className="w-full px-4 py-3 pl-11 border border-[var(--color-border)]/60 rounded-xl text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text)] dark:text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
          />
          <svg 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/40 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-[var(--color-border)] rounded w-1/3 mb-3" />
              <div className="h-4 bg-[var(--color-border)] rounded w-full" />
            </div>
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/40 rounded-2xl p-16 text-center backdrop-blur-md">
          <p className="text-sm text-[var(--color-text-secondary)]">No tags found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map(tag => (
            <Link 
              key={tag._id} 
              href={`/tags/${tag.name}`} 
              className="group bg-[var(--color-bg-secondary)]/80 backdrop-blur-md border border-[var(--color-border)]/60 rounded-2xl p-6 block transition-all duration-300 hover:shadow-lg hover:border-[var(--color-primary)]/30 hover:-translate-y-1"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/10 group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors duration-300">
                  #{tag.name}
                </span>
                {tag.isOfficial && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Official
                  </span>
                )}
              </div>
              {tag.description && (
                <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2 leading-relaxed">
                  {tag.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]/40 pt-3">
                <span className="font-medium text-[var(--color-text-secondary)]/80">
                  {tag.questionCount || 0} questions
                </span>
                {tag.category && (
                  <span className="capitalize text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-bg-tertiary)] font-bold">
                    {tag.category}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
