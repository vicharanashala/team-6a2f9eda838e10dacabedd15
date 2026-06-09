'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

export default function PrashnaSarathiWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Namaste! I am PrashnaSārathi, your AI-powered knowledge discovery assistant. How can I help you find answers today?',
      status: 'Success',
      source: 'System',
      relatedTopics: []
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll messages to the bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Context-aware prompt suggestions based on current path
  const getPageSuggestions = () => {
    if (pathname.startsWith('/questions')) {
      return [
        'How to ask a question?',
        'How does voting work on answers?',
        'What are Spurti Points (SP)?'
      ];
    }
    if (pathname.startsWith('/faqs')) {
      return [
        'What is a NOC?',
        'Who can sign my NOC?',
        'How to submit internship logs?'
      ];
    }
    if (pathname.startsWith('/admin')) {
      return [
        'How to view audit logs?',
        'How to resolve suspicious flags?',
        'What is the role of a moderator?'
      ];
    }
    return [
      'What is this platform?',
      'How to earn SP points?',
      'Tell me about PrashnaSārathi'
    ];
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || query).trim();
    if (!text) return;
    if (!textToSend) setQuery('');

    // Append user message
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setLoading(true);

    const isOffline = typeof window !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: 'Namaste! PrashnaSārathi AI Assistant requires an active internet connection and is not available offline. Please check your network connection and try again.',
          status: 'Offline',
          source: 'System'
        }]);
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      const pageTitle = typeof document !== 'undefined' ? document.title : '';

      // Use native fetch so non-2xx responses don't throw — they return graceful JSON
      const params = new URLSearchParams({ q: text, currentUrl, pageTitle });
      const res = await fetch(`/api/search/ai?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (data.status === 'blocked') {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `⚠️ ${data.message || 'Blocked due to safety guidelines.'}`,
          status: 'blocked'
        }]);
      } else {
        const displayText = data.answer || data.message || 'No matching information was found in the available knowledge sources.';
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: displayText,
          status: data.status,
          source: data.source,
          relatedTopics: data.relatedTopics || []
        }]);
      }
    } catch (err) {
      console.error('Widget AI error:', err);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Could not reach the AI assistant. Please check your connection.',
        status: 'Error'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = getPageSuggestions();

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-40 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white p-3.5 rounded-full shadow-xl hover:shadow-purple-500/25 hover:scale-105 transition-all duration-300 border border-purple-500/25 flex items-center justify-center group"
        title="PrashnaSārathi AI Assistant"
      >
        <span className="relative flex h-3 w-3 absolute -top-0.5 -right-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
        </span>
        <svg
          className="w-6 h-6 animate-pulse group-hover:rotate-12 transition-transform duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-36 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)] leading-none">PrashnaSārathi AI</h3>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 truncate max-w-[180px]">
                  Monitoring: <span className="font-semibold text-purple-400">{pathname}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-1 rounded-lg hover:bg-[var(--color-border)]/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-purple-950/5 to-transparent">
            {messages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[var(--color-primary)] text-white rounded-tr-none shadow'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] rounded-tl-none border border-[var(--color-border)]/40 shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  
                  {/* Bot attributes */}
                  {msg.sender === 'bot' && msg.source && (
                    <div className="mt-2 text-[9px] text-[var(--color-text-secondary)] font-semibold flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/40">Source: {msg.source}</span>
                    </div>
                  )}
                </div>

                {/* Related topics pills */}
                {msg.sender === 'bot' && msg.relatedTopics?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 max-w-[85%] pl-1">
                    {msg.relatedTopics.map((topic, topicIdx) => (
                      <button
                        key={topicIdx}
                        onClick={() => handleSend(topic)}
                        className="px-2 py-1 text-[10px] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all font-medium cursor-pointer"
                      >
                        🔍 {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]/40 text-[var(--color-text)] rounded-2xl rounded-tl-none p-3 shadow-sm max-w-[85%] w-full animate-pulse space-y-2">
                  <div className="h-3 bg-[var(--color-border)]/60 rounded w-1/3" />
                  <div className="h-3 bg-[var(--color-border)]/60 rounded w-full" />
                  <div className="h-3 bg-[var(--color-border)]/60 rounded w-5/6" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Panel */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]/30">
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">Suggested Prompts</p>
              <div className="flex flex-col gap-1">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="text-left w-full px-2.5 py-1 text-[11px] rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors border border-[var(--color-border)]/45"
                  >
                    💡 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask PrashnaSārathi..."
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/95 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
