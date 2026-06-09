'use client';
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate, truncate } from '@/lib/utils';
import { useTypewriter } from '@/hooks/useTypewriter';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

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

const cleanAndCorrectQuery = (text) => {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Replace variations of "wins" / "wings" / etc with "VINS"
  cleaned = cleaned.replace(/\b(wins|wings|vince|wince|winsome|vin|win|wing)\b/ig, 'VINS');
  cleaned = cleaned.replace(/\b(vicharana\s*shala|vicharan\s*shala|vicharana\s*sala)\b/ig, 'Vicharanashala');
  cleaned = cleaned.replace(/\b(samagama)\b/ig, 'Samagama');
  cleaned = cleaned.replace(/\b(spurti|sphurti|sphurthi)\b/ig, 'Spurti');
  cleaned = cleaned.replace(/\byaksha\b/ig, 'Yaksha');
  cleaned = cleaned.replace(/\bsamagam\b/ig, 'samagama.in');
  cleaned = cleaned.replace(/\bprashna\s*sarathi\b/ig, 'PrashnaSārathi');
  
  return cleaned;
};

const SearchModal = forwardRef(function SearchModal({ isOpen, onClose, autoStart }, ref) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const { text: placeholderText, pause, resume } = useTypewriter();
  const recognitionRef = useRef(null);

  useImperativeHandle(ref, () => ({
    startListening: handleVoiceInput
  }));

  const handleVoiceInput = () => {
    if (typeof window === 'undefined') return;

    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
        recognitionRef.current = null;
      }
      setListening(false);
      return;
    }

    // Attempt native SpeechRecognition first
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN'; // use Indian English for better phrase matching
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;

      const defaultSilenceTimeout = 5000;
      const extendedSilenceTimeout = 15000;
      let silenceTimer;
      let currentTimeout = defaultSilenceTimeout;
      const resetSilenceTimer = () => {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          recognition.stop();
          setListening(false);
          performSearch(query);
        }, currentTimeout);
      };
      recognition.onstart = () => {
        setListening(true);
        resetSilenceTimer();
      };
      recognition.onresult = (event) => {
        clearTimeout(silenceTimer);
        let interim = '';
        let final = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        
        // Lenient regex to detect and strip out activation phrases in user search if they say them
        const activationPhrase = /(hey\s+)?(prashna|prasna|prishna|prisna|prasanna|krishna|prashan|prasan)\s*(sarathi|sarthi|sarati)/i;
        
        let processedFinal = final.replace(activationPhrase, '').trim();
        let processedInterim = interim.replace(activationPhrase, '').trim();
        
        // Correct phonetic errors
        processedFinal = cleanAndCorrectQuery(processedFinal);
        processedInterim = cleanAndCorrectQuery(processedInterim);

        if (processedFinal) {
          setQuery(processedFinal);
          recognition.stop();
          setListening(false);
          performSearch(processedFinal);
        } else {
          setQuery(processedInterim);
          resetSilenceTimer();
        }
      };
      recognition.onerror = (e) => {
        if (e.error !== 'aborted') {
          console.error('Speech recognition error', e);
          toast.error('Voice input error');
          // Fallback to AI transcription if microphone captured audio
          fallbackToAI();
        }
      };
      recognition.onend = () => {
        clearTimeout(silenceTimer);
        setListening(false);
      };
      recognition.start();
      recognitionRef.current = recognition;
    } else {
      // Browser does not support SpeechRecognition – fall back to AI transcription
      fallbackToAI();
    }

    // Helper to capture a short audio snippet and send to backend AI model
    async function fallbackToAI() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const resp = await fetch('/api/search/transcribe', {
            method: 'POST',
            body: blob
          });
          const data = await resp.json();
          if (data?.text) {
            const correctedText = cleanAndCorrectQuery(data.text);
            setQuery(correctedText);
            performSearch(correctedText);
          }
        };
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 5000); // record up to 5 seconds
      } catch (err) {
        console.error('AI transcription fallback failed', err);
        toast.error('Voice input unavailable');
      }
    }
  };


  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      resume();
    } else {
      pause();
    }
  }, [isOpen, pause, resume]);

  // Auto‑start listening when opened via activation phrase
  useEffect(() => {
    if (isOpen && autoStart) {
      const timer = setTimeout(() => {
        handleVoiceInput();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoStart]);

  useEffect(() => {
    if (query.trim()) {
      pause();
    } else {
      resume();
    }
  }, [query, pause, resume]);

  const performSearch = async (searchQuery) => {
    const corrected = cleanAndCorrectQuery(searchQuery);
    const sanitized = corrected.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[\u003c\u003e]/g, "");
    if (!sanitized) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get('/search', { q: sanitized, type });
      setResults(data.results || []);
      setSelectedIndex(-1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 200);
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
        const link = getSearchResultLink(result);
        router.push(link);
        onClose();
      } else {
        const sanitized = query.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[\u003c\u003e]/g, "");
        if (sanitized) {
          router.push(`/search?q=${encodeURIComponent(sanitized)}${type ? `&type=${type}` : ''}`);
        }
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
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleResultClick = (result) => {
    const link = getSearchResultLink(result);
    router.push(link);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 pt-20 pb-8 flex items-start justify-center">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-[var(--color-border)] animate-scale-in">
          <div className="p-5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3 relative">
              <svg className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="flex-1 relative" style={{ height: '44px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-full text-lg outline-none bg-transparent text-[var(--color-text)] relative z-10"
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full ${listening ? 'bg-[var(--color-primary)] text-white animate-pulse' : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)]'} z-20`}
                  aria-label="Voice input"
                  aria-pressed={listening}
                >
                  🎤
                </button>
                {!query && (
                  <span className="absolute inset-0 flex items-center text-lg text-[var(--color-text-muted)] pointer-events-none overflow-hidden whitespace-nowrap">
                    {placeholderText}
                  </span>
                )}
              </div>
              {loading ? (
                <svg className="animate-spin w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border)]">ESC</kbd>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {['', 'questions', 'faqs', 'users'].map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${type === t ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]'}`}
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
                  const typeLabel = result._type || (result.body !== undefined ? 'question' : result.description !== undefined ? 'faq' : 'user');
                  const title = result.title || result.question || result.faqTitle || result.displayName || result.username || 'Untitled';
                  const desc = result.body || result.description || result.answer || result.bio || '';
                  const link = getSearchResultLink(result);
                  return (
                    <li key={result.id}>
                      <button
                        onClick={() => handleResultClick(result)}
                        className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors ${selectedIndex === index ? 'bg-[var(--color-primary-subtle)]' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
                      >
                        <span className="badge-gray text-xs capitalize mt-0.5 shrink-0">{typeLabel}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-[var(--color-text)] truncate">{title}</h4>
                          {desc && <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 mt-0.5">{truncate(desc, 100)}</p>}
                          {result.tags?.length > 0 && (
                            <div className="flex gap-1.5 mt-2">
                              {result.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="badge-primary text-xs">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedIndex === index && (
                          <span className="text-xs text-[var(--color-primary)] shrink-0 font-medium">Enter to select</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : query.trim() && !loading ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm font-medium">No results found for "{query}"</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">Press Enter to search all pages</p>
              </div>
            ) : !query.trim() ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-muted)] text-sm">Start typing to search...</p>
                <div className="flex items-center justify-center gap-6 mt-5 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1.5"><kbd className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]">↑</kbd> <kbd className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]">↓</kbd> navigate</span>
                  <span className="flex items-center gap-1.5"><kbd className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]">Enter</kbd> select</span>
                  <span className="flex items-center gap-1.5"><kbd className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)]">Esc</kbd> close</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SearchModal;
