'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

const STEPS = [
  {
    title: 'Welcome to PrashnaSārathi!',
    description: 'Your doubts are welcome here. This platform is here to help you learn without fear of asking.',
    icon: (
      <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.561 18.082A7.506 7.506 0 006 8.344M16 12a4 4 0 10-8 0 4 4 0 008 0zM12 15.75c1.5 0 3-1.25 3-3s-1.5-3-3-3m0 0V8.25m0 12.75h-4.5" />
      </svg>
    ),
  },
  {
    title: 'Browse FAQs first',
    description: 'Many common questions are already answered in our FAQ section. Check if yours is there before asking.',
    action: { label: 'Go to FAQs', href: '/faqs' },
    icon: (
      <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.232.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Search before asking',
    description: 'Your doubt might already be solved. Use the search bar to find existing questions and answers.',
    hint: 'Press / or Ctrl+K to open search',
    icon: (
      <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: 'Ask your first question',
    description: "Couldn't find your answer? Go ahead and ask! You can post anonymously if you prefer.",
    action: { label: 'Ask a Question', href: '/questions/ask' },
    icon: (
      <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Select your current phase',
    description: 'This helps us personalize FAQ recommendations to guide your current learning journey.',
    isPhaseSelection: true,
    icon: (
      <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

export default function OnboardingModal() {
  const { user, loading, completeOnboarding } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState('pre');
  const [isQuickPhaseFill, setIsQuickPhaseFill] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);

  useEffect(() => {
    if (!user || loading) {
      setIsOpen(false);
      return;
    }
    if (user.role === 'admin' || user.role === 'moderator') return;

    // Prevent repeated popups if user dismissed the prompt
    if (typeof window !== 'undefined' && localStorage.getItem(`phase_prompt_dismissed_${user.id}`)) {
      return;
    }

    const needsOnboarding = !user.hasCompletedOnboarding;
    const needsPhaseSelection = !user.currentPhase;

    if (needsOnboarding) {
      setStep(0);
      setIsQuickPhaseFill(false);
      setIsOpen(true);
    } else if (needsPhaseSelection) {
      // Existing user who hasn't selected a phase -> jump directly to phase selection step in quick mode
      setStep(STEPS.length - 1);
      setIsQuickPhaseFill(true);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user, loading]);

  const handleDismiss = async (phaseValue = null) => {
    try {
      const data = await completeOnboarding(phaseValue);
      if (data && data.emailPreview) {
        setEmailPreview(data.emailPreview);
        return;
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(`phase_prompt_dismissed_${user.id}`, 'true');
    }
    setDismissed(true);
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss(selectedPhase);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem(`phase_prompt_dismissed_${user.id}`, 'true');
    }
    handleDismiss(null);
  };

  if (!isOpen || dismissed) {
    if (emailPreview) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-primary-600 to-cyan-500 p-6 text-white text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📬</span>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">Welcome Email Sent!</h2>
                    <p className="text-xs text-white/80">SMTP Simulated Dispatch (Local Preview)</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (typeof window !== 'undefined' && user) {
                      localStorage.setItem(`phase_prompt_dismissed_${user.id}`, 'true');
                    }
                    setEmailPreview(null);
                    setDismissed(true);
                    setIsOpen(false);
                  }} 
                  className="text-white/80 hover:text-white text-2xl font-semibold focus:outline-none"
                >
                  &times;
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg border border-[var(--color-border)] text-sm space-y-1">
                <div><span className="font-semibold text-[var(--color-text-secondary)]">From:</span> PrashnaSārathi Notifications &lt;no-reply@faqportal.in&gt;</div>
                <div><span className="font-semibold text-[var(--color-text-secondary)]">To:</span> {user?.email}</div>
                <div><span className="font-semibold text-[var(--color-text-secondary)]">Subject:</span> {emailPreview.subject}</div>
              </div>
              
              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: emailPreview.html }} />
              </div>
            </div>
            
            <div className="px-6 pb-6 pt-2 flex justify-end">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && user) {
                    localStorage.setItem(`phase_prompt_dismissed_${user.id}`, 'true');
                  }
                  setEmailPreview(null);
                  setDismissed(true);
                  setIsOpen(false);
                }}
                className="btn-primary px-6 py-2.5 text-sm font-semibold rounded-xl"
              >
                Continue to Platform
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const modalTitle = isQuickPhaseFill ? 'Quick Update: Select Your Phase' : current.title;
  const modalDescription = isQuickPhaseFill 
    ? 'To help personalize FAQ recommendations for your learning journey, please select your current internship phase below:' 
    : current.description;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleSkip} />
      <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-8 text-center max-h-[85vh] overflow-y-auto">
          <div className="flex justify-center mb-6">{current.icon}</div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">{modalTitle}</h2>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-6">{modalDescription}</p>

          {current.isPhaseSelection ? (
            <div className="flex flex-col gap-2.5 mb-6 text-left">
              {[
                { id: 'pre', name: 'Pre-Internship', desc: 'Getting Started & ViBe Platform' },
                { id: 'phase1_coursework', name: 'Phase 1 - Coursework', desc: 'Vibe LMS & Live sessions' },
                { id: 'phase1_completed', name: 'Phase 1 Completed', desc: 'Team Formation & Yaksha Chat' },
                { id: 'phase2_project', name: 'Phase 2 - Project', desc: 'Interviews & Certificate' },
                { id: 'completed', name: 'Completed / Alumni', desc: 'Certificate & Alumni network' }
              ].map((p) => {
                const isSel = selectedPhase === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPhase(p.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      isSel
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-text)] font-semibold shadow-sm'
                        : 'border-[var(--color-border)]/60 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-bg-tertiary)]/50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {current.hint && (
                <div className="mb-6 px-4 py-2 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-secondary)]">{current.hint}</p>
                </div>
              )}

              {current.action && (
                <Link
                  href={current.action.href}
                  className="inline-block mb-6 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  onClick={() => handleDismiss(null)}
                >
                  {current.action.label}
                </Link>
              )}
            </>
          )}
        </div>

        <div className="px-8 pb-6">
          {isQuickPhaseFill ? (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleNext}
                className="w-full btn-primary py-2.5 text-sm font-semibold rounded-xl"
              >
                Save & Continue
              </button>
              <button
                onClick={handleSkip}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
              >
                Remind me later
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={step === 0}
                  className={`text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] ${step === 0 ? 'opacity-0' : ''}`}
                >
                  &larr; Back
                </button>

                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === step ? 'bg-primary-600' : i < step ? 'bg-primary-300' : 'bg-[var(--color-border)]'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {isLast ? 'Get Started' : 'Next \u2192'}
                </button>
              </div>

              <button
                onClick={handleSkip}
                className="mt-4 w-full text-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                Skip tour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}