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
  },
  {
    title: 'Search before asking',
    description: 'Your doubt might already be solved. Use the search bar to find existing questions and answers.',
    hint: 'Press / or Ctrl+K to open search',
  },
  {
    title: 'Ask your first question',
    description: "Couldn\'t find your answer? Go ahead and ask! You can post anonymously if you prefer.",
    action: { label: 'Ask a Question', href: '/questions/ask' },
  },
];

export default function OnboardingModal() {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

useEffect(() => {
    if (!user || loading) return;
    if (user.hasCompletedOnboarding) return;
    if (user.role === 'admin' || user.role === 'moderator') return;
    setIsOpen(true);
  }, [user, loading]);

  const handleDismiss = async () => {
    try {
      await api.patch('/users/me/onboarding');
    } catch (_) {}
    setDismissed(true);
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    handleDismiss();
  };

  if (!isOpen || dismissed) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleSkip} />
      <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-8 text-center">
          <div className="flex justify-center mb-6">{current.icon}</div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">{current.title}</h2>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-6">{current.description}</p>

          {current.hint && (
            <div className="mb-6 px-4 py-2 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-secondary)]">{current.hint}</p>
            </div>
          )}

          {current.action && (
            <Link
              href={current.action.href}
              className="inline-block mb-6 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              onClick={handleDismiss}
            >
              {current.action.label}
            </Link>
          )}
        </div>

        <div className="px-8 pb-6">
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
        </div>
      </div>
    </div>
  );
}