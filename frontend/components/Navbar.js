'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getInitials } from '@/lib/utils';

export default function Navbar({ onSearch }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <nav className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-primary-600">
              PrashnaSārathi
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link href="/questions" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Questions
              </Link>
              <Link href="/faqs" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                FAQs
              </Link>
              <Link href="/tags" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Tags
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-lg mx-4">
            <form onSubmit={handleSearch} className="w-full relative">
              <input
                type="text"
                placeholder="Search questions, FAQs, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)] bg-gray-100 dark:bg-gray-700 rounded">/</kbd>
            </form>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/questions/ask" className="btn-primary btn-sm hidden md:flex">
                  Ask Question
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium">
                      {getInitials(user.displayName || user.username)}
                    </div>
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-[var(--color-bg-secondary)] rounded-xl shadow-lg border border-[var(--color-border)] z-20 py-1">
                        <div className="px-4 py-2 border-b border-[var(--color-border)]">
                          <p className="text-sm font-medium text-[var(--color-text)]">{user.displayName || user.username}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{user.reputation} reputation</p>
                        </div>
                        <Link href={`/users/${user.username}`} className="block px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>
                          Profile
                        </Link>
                        <Link href="/saved" className="block px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>
                          Saved
                        </Link>
                        <Link href="/notifications" className="block px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>
                          Notifications
                        </Link>
                        {(user.role === 'admin' || user.role === 'moderator') && (
                          <Link href="/admin" className="block px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => setProfileOpen(false)}>
                            Admin Panel
                          </Link>
                        )}
                        <hr className="my-1 border-[var(--color-border)]" />
                        <button
                          onClick={() => { logout(); setProfileOpen(false); }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth?mode=login" className="btn-secondary btn-sm">
                  Login
                </Link>
                <Link href="/auth?mode=signup" className="btn-primary btn-sm">
                  Sign Up
                </Link>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-3 border-t border-[var(--color-border)] pt-3">
            <form onSubmit={handleSearch} className="mb-3">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg)] text-[var(--color-text)]"
              />
            </form>
            <div className="space-y-1">
              <Link href="/questions" className="block px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Questions</Link>
              <Link href="/faqs" className="block px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">FAQs</Link>
              <Link href="/tags" className="block px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Tags</Link>
              {user && <Link href="/questions/ask" className="block px-3 py-2 text-sm text-primary-600 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Ask Question</Link>}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
