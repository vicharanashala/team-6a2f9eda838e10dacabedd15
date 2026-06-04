'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

const PHASE_LABELS = {
  pre: 'Pre-Internship',
  phase1_coursework: 'Phase 1 – Coursework',
  phase1_completed: 'Phase 1 Completed',
  phase2_project: 'Phase 2 – Project',
  completed: 'Alumni / Completed',
};

export default function RecommendedFAQs({ limit = 6, layout = 'grid' }) {
  const { user } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [localVotes, setLocalVotes] = useState({});
  const [phaseLabel, setPhaseLabel] = useState(null);
  const [isGuestOrNoPhase, setIsGuestOrNoPhase] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [user]); // Reload whenever user state changes (login, phase update)

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const params = user ? { userId: user.id } : {};
      const data = await api.get('/faqs/recommended', params);
      const recommendedList = data.faqs || [];
      setFaqs(recommendedList.slice(0, limit));

      // Determine phase context label
      if (user && user.currentPhase) {
        setPhaseLabel(PHASE_LABELS[user.currentPhase] || user.currentPhase);
        setIsGuestOrNoPhase(false);
      } else {
        // Guest or user without phase — show trending/official, with a CTA
        setPhaseLabel(null);
        setIsGuestOrNoPhase(true);
      }
    } catch (err) {
      console.error('Failed to load recommended FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (faqId) => {
    setExpandedFaq(expandedFaq === faqId ? null : faqId);
  };

  const handleFeedback = async (faqId, itemId, helpful) => {
    if (!user) {
      toast.error('Please login to vote');
      return;
    }
    const currentVote = localVotes[itemId];
    const isUndo = currentVote === (helpful ? 'helpful' : 'notHelpful');
    try {
      const data = await api.post(`/faqs/${faqId}/items/${itemId}/feedback`, { helpful, undo: isUndo });
      if (data.voted === null) {
        setLocalVotes(prev => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        toast.success('Vote removed');
      } else {
        setLocalVotes(prev => ({ ...prev, [itemId]: data.voted }));
        toast.success(helpful ? 'Glad this helped!' : 'Thanks for the feedback');
      }
      setFaqs(prev => prev.map(faq => {
        if (faq._id !== faqId) return faq;
        return {
          ...faq,
          items: faq.items.map(item => {
            if (item._id !== itemId) return item;
            return { ...item, helpfulCount: data.helpfulCount, notHelpfulCount: data.notHelpfulCount };
          })
        };
      }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/40 rounded-2xl p-5 animate-pulse">
            <div className="h-5 bg-[var(--color-border)] rounded w-3/4 mb-3" />
            <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // Guest or no-phase: show a gentle CTA to set phase, then show official/trending FAQs
  if (isGuestOrNoPhase) {
    return (
      <div>
        {/* CTA Banner for phase-less users */}
        {user && !user.currentPhase && (
          <div className="mb-4 p-3.5 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 flex items-center gap-3">
            <span className="text-xl">🎯</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text)]">Personalise your recommendations</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
                Set your internship phase to see FAQs most relevant to where you are right now.
              </p>
            </div>
            <Link
              href="/auth?mode=login"
              className="shrink-0 text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded-lg px-3 py-1.5 hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              Update Phase
            </Link>
          </div>
        )}

        {!user && (
          <div className="mb-4 p-3.5 rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-bg-secondary)]/50 flex items-center gap-3">
            <span className="text-xl">💡</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text)]">Showing trending &amp; official FAQs</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
                <Link href="/auth?mode=login" className="text-[var(--color-primary)] hover:underline font-semibold">Log in</Link> to get personalised recommendations based on your internship phase.
              </p>
            </div>
          </div>
        )}

        {faqs.length === 0 ? null : renderFAQList(faqs)}
      </div>
    );
  }

  if (faqs.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Phase context label */}
      {phaseLabel && (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/15">
            🎯 Curated for: {phaseLabel}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">Based on your phase &amp; activity</span>
        </div>
      )}
      {renderFAQList(faqs)}
    </div>
  );

  function renderFAQList(list) {
    if (layout === 'sidebar') {
      return (
        <div className="space-y-3">
          {list.map(faq => (
            <div key={faq._id} className="p-3.5 bg-[var(--color-bg-secondary)]/70 hover:bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]/40 hover:border-[var(--color-primary)]/30 transition-all duration-200">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {faq.phaseMatch && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    🎯 Phase Match
                  </span>
                )}
                {faq.isOfficial && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    ⭐ Official
                  </span>
                )}
              </div>
              <Link href={`/faqs/${faq.slug}`} className="text-xs font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors line-clamp-2 leading-snug">
                {faq.title}
              </Link>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-1">{faq.description || 'No description available.'}</p>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {list.map((faq) => {
          const isExpanded = expandedFaq === faq._id;
          return (
            <div
              key={faq._id}
              className={`bg-[var(--color-bg-secondary)]/80 backdrop-blur-md rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded
                  ? 'border-[var(--color-primary)]/40 shadow-md shadow-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)]/60 hover:border-[var(--color-primary)]/30 hover:shadow-sm hover:-translate-y-0.5'
              }`}
            >
              {/* FAQ Header */}
              <button
                onClick={() => toggleFaq(faq._id)}
                className="w-full p-5 text-left flex items-start justify-between gap-4 hover:bg-[var(--color-bg-tertiary)]/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {faq.phaseMatch && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        🎯 Recommended for your phase
                      </span>
                    )}
                    {faq.matchingTagsCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        🏷️ Tag Match
                      </span>
                    )}
                    {faq.isOfficial && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        ⭐ Official
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-text-muted)] font-medium ml-auto">
                      {faq.items?.length || 0} items
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)] leading-snug">
                    {faq.title}
                  </h3>
                  {faq.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                      {faq.description}
                    </p>
                  )}
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-secondary)] transition-all shrink-0 ${
                  isExpanded ? 'rotate-180 bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]' : ''
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Accordion Content */}
              {isExpanded && faq.items?.length > 0 && (
                <div className="border-t border-[var(--color-border)]/50 divide-y divide-[var(--color-border)]/40 bg-[var(--color-bg)]/20">
                  {faq.items
                    .filter(item => item.isPublished)
                    .map((item) => (
                      <div key={item._id} className="p-5 hover:bg-[var(--color-bg-secondary)]/30 transition-colors">
                        <div className="text-sm font-semibold text-[var(--color-text)] mb-2 flex items-start gap-2">
                          <span className="text-[var(--color-primary)] text-base mt-0.5">Q.</span>
                          <span>{item.question}</span>
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)] pl-6 pr-4 mb-4 leading-relaxed whitespace-pre-wrap">
                          {item.answer}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] pl-6">
                          <span className="font-medium text-[var(--color-text-secondary)]/80">Was this helpful?</span>
                          <button
                            onClick={() => handleFeedback(faq._id, item._id, true)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                              localVotes[item._id] === 'helpful'
                                ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 font-semibold'
                                : 'border-[var(--color-border)]/50 hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                            <span>Yes ({item.helpfulCount || 0})</span>
                          </button>
                          <button
                            onClick={() => handleFeedback(faq._id, item._id, false)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                              localVotes[item._id] === 'notHelpful'
                                ? 'text-red-600 bg-red-500/10 border-red-500/20 font-semibold'
                                : 'border-[var(--color-border)]/50 hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                            <span>No ({item.notHelpfulCount || 0})</span>
                          </button>
                          <Link
                            href={`/faqs/${faq.slug}`}
                            className="ml-auto text-[var(--color-primary)] hover:underline text-[10px] font-semibold shrink-0"
                          >
                            View full FAQ →
                          </Link>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
}
