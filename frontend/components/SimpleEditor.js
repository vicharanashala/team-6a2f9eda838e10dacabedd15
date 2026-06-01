'use client';
import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export default function SimpleEditor({ content = '', onChange, placeholder = 'Write something...', minHeight = '200px' }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className={`px-3 py-1 text-sm rounded ${!showPreview ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-[var(--color-text)] hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className={`px-3 py-1 text-sm rounded ${showPreview ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-[var(--color-text)] hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Preview
        </button>
      </div>
      {showPreview ? (
        <div className="p-4 min-h-[200px]" style={{ minHeight }}>
          {content ? <MarkdownRenderer content={content} /> : <p className="text-[var(--color-text-secondary)]">Nothing to preview</p>}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none resize-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}