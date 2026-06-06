'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function TermsAndConditionsModal() {
  const { user, loading, acceptTerms } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Do not render if user is not logged in or has already accepted terms
  if (loading || !user || user.hasAcceptedTerms) {
    return null;
  }

  // Exempt admins/moderators if necessary, but user says "for existing users pop up with terms and condition to accept", so we show to all users
  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await acceptTerms();
    } catch (err) {
      console.error('Failed to accept terms:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal Card */}
      <div className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-700 p-6 text-white text-left">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚖️</span>
            <div>
              <h2 className="text-xl font-bold leading-tight">Rules & Regulations</h2>
              <p className="text-xs text-white/80">Please review the platform rules before proceeding</p>
            </div>
          </div>
        </div>

        {/* Content - Rules List */}
        <div className="p-6 space-y-4 text-left max-h-[50vh] overflow-y-auto border-b border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Welcome to <strong>PrashnaSārathi</strong>. To foster a safe, inclusive, and collaborative learning environment, all members are required to abide by our code of conduct:
          </p>

          <ol className="space-y-3.5 list-decimal list-inside text-sm text-[var(--color-text)]">
            <li className="leading-relaxed">
              <span className="font-semibold text-primary-600">Respect & Inclusivity:</span> Treat fellow students, mentors, and administrators with kindness and professionalism. Cyberbullying, harassment, or hate speech is strictly prohibited.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-primary-600">Academic Integrity:</span> Share knowledge and explain concepts, but avoid plagiarism. If copying code snippets, external sources must be properly attributed.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-primary-600">No Spam or Irrelevant Content:</span> Keep discussions relevant to learning. Do not post advertising, commercial links, or generic spam. High violation count leads to automatic trust score deduction.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-primary-600">Privacy & Security:</span> Never share credentials, access tokens, API keys, or private identifiers of yourself or others in public questions or answers.
            </li>
            <li className="leading-relaxed">
              <span className="font-semibold text-primary-600">Moderation Authority:</span> Moderators and Admins reserve the right to edit, hide, or ban content/users violating these terms.
            </li>
          </ol>
        </div>

        {/* Footer with Checkbox & CTA */}
        <div className="p-6 bg-[var(--color-bg-tertiary)] space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group text-left">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4.5 w-4.5 rounded border-[var(--color-border)] text-primary-600 focus:ring-primary-500 accent-primary-600"
            />
            <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)] transition-colors select-none">
              I have read the rules and agree to abide by the PrashnaSārathi terms & conditions.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className={`w-full py-3 px-6 text-sm font-semibold rounded-xl transition-all duration-200 text-white shadow-md flex items-center justify-center gap-2 ${
              agreed && !submitting
                ? 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 hover:shadow-lg'
                : 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-50'
            }`}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              'Accept & Continue'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
