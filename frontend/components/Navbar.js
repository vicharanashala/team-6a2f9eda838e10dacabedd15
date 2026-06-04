'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTypewriter } from '@/hooks/useTypewriter';
import { getInitials } from '@/lib/utils';
import { useNotifications } from '@/context/NotificationContext';

export default function Navbar({ onSearch }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const notifications = useNotifications();
  const unreadCount = notifications ? notifications.unreadCount : 0;
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navbarInputRef = useRef(null);
  const { text: placeholderText, pause, resume } = useTypewriter();

  useEffect(() => {
    if (searchQuery.trim()) {
      pause();
    } else {
      resume();
    }
  }, [searchQuery, pause, resume]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <nav className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-lg border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400">
                PrashnaSārathi
              </Link>
              <div className="hidden md:flex items-center gap-1">
                <Link href="/questions" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors">
                  Questions
                </Link>
                <Link href="/faqs" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors">
                  FAQs
                </Link>
                <a href="https://samagama.in" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors">
                  samagama.in
                </a>
                <Link href="/tags" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors">
                  Tags
                </Link>
                <Link href="/users" className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors">
                  Community
                </Link>
                {user && (user.role === 'admin' || user.role === 'moderator') && (
                  <Link href="/admin" className="px-3 py-2 text-sm font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition-colors">
                    Admin Panel
                  </Link>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center flex-1 max-w-lg mx-4">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative w-full" style={{ height: '40px' }}>
                  <input
                    ref={navbarInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-full px-4 py-2.5 pr-12 border border-[var(--color-border)] rounded-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
                  />
                  {!searchQuery && (
                    <span className="absolute inset-0 flex items-center pl-4 pr-12 text-sm text-[var(--color-text-muted)] pointer-events-none overflow-hidden whitespace-nowrap">
                      {placeholderText}
                    </span>
                  )}
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center px-2 py-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)]">/</kbd>
                </div>
              </form>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link href="/questions/ask" className="btn-primary btn-sm hidden md:flex">
                    Ask Question
                  </Link>

                  {/* Notification Bell */}
                  <Link href="/notifications" className="relative p-2 rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors" aria-label="Notifications">
                    <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      {user.avatar || user.avatarUrl ? (
                        <img
                      src={user.avatar ? ((user.avatar.startsWith('http') || user.avatar.startsWith('data:')) ? user.avatar : `/api/uploads${user.avatar}`) : user.avatarUrl}
                          alt={user.displayName || user.username}
                          className="w-8 h-8 rounded-xl object-cover shadow-md border border-[var(--color-border)]/40"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!(user.avatar || user.avatarUrl) && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-500 text-white flex items-center justify-center text-sm font-semibold shadow-md">
                          {getInitials(user.displayName || user.username)}
                        </div>
                      )}
                    </button>
                    {profileOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                        <div className="absolute right-0 mt-2 w-56 bg-[var(--color-bg-secondary)] rounded-xl shadow-xl border border-[var(--color-border)] z-20 py-1.5 animate-scale-in">
                          <div className="px-4 py-3 border-b border-[var(--color-border)]">
                            <p className="text-sm font-semibold text-[var(--color-text)]">{user.displayName || user.username}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{user.reputation} reputation</p>
                          </div>
                          <Link href={`/users/${user.username}`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-colors" onClick={() => setProfileOpen(false)}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Profile
                          </Link>
                          <Link href="/saved" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-colors" onClick={() => setProfileOpen(false)}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            Saved
                          </Link>
                          <Link href="/notifications" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-colors" onClick={() => setProfileOpen(false)}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            Notifications
                          </Link>
                          {(user.role === 'admin' || user.role === 'moderator') && (
                            <Link href="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] transition-colors" onClick={() => setProfileOpen(false)}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Admin Panel
                            </Link>
                          )}
                          <hr className="my-1.5 border-[var(--color-border)]" />
                          <button
                            onClick={() => { logout(); setProfileOpen(false); }}
                            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Logout
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth?mode=login" className="btn-ghost btn-sm">
                    Login
                  </Link>
                  <Link href="/auth?mode=signup" className="btn-primary btn-sm">
                    Sign Up
                  </Link>
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
              <button className="md:hidden p-2 rounded-xl hover:bg-[var(--color-bg-tertiary)]" onClick={() => setMenuOpen(!menuOpen)}>
                <svg className="w-5 h-5 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="md:hidden pb-4 border-t border-[var(--color-border)] pt-4">
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative" style={{ height: '40px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-full px-4 py-2.5 pr-10 border border-[var(--color-border)] rounded-xl text-sm bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
                  />
                  {!searchQuery && (
                    <span className="absolute inset-0 flex items-center pl-4 pr-10 text-sm text-[var(--color-text-muted)] pointer-events-none overflow-hidden whitespace-nowrap">
                      {placeholderText}
                    </span>
                  )}
                </div>
              </form>
              <div className="space-y-1">
                <Link href="/questions" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">Questions</Link>
                <Link href="/faqs" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">FAQs</Link>
                <Link href="/tags" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">Tags</Link>
                <Link href="/users" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">Community</Link>
                {user && <Link href="/questions/ask" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--color-primary)] font-medium hover:bg-[var(--color-primary-subtle)] rounded-lg transition-colors">Ask Question</Link>}
              </div>
            </div>
          )}
        </div>
      </nav>
      {user && user.status === 'warned' && (
        <div className="bg-amber-600 text-white text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Warning: Your account has received moderation warnings for behavior policy violations. Please review community guidelines.</span>
        </div>
      )}
      {user && user.status === 'suspended' && (
        <div className="bg-red-600 text-white text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>Notice: Your account is currently suspended{user.suspendedUntil ? ` until ${new Date(user.suspendedUntil).toLocaleDateString()}` : ''}. Post creation is restricted.</span>
        </div>
      )}
    </>
  );
}