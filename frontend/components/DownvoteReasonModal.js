'use client';
import { useState } from 'react';

const DOWNVOTE_REASONS = [
  { value: 'incorrect', label: 'Incorrect', desc: 'The answer is factually wrong' },
  { value: 'incomplete', label: 'Incomplete', desc: 'Missing important details or steps' },
  { value: 'unclear', label: 'Unclear', desc: 'Difficult to understand the explanation' },
  { value: 'harmful', label: 'Harmful', desc: 'Could lead to bad outcomes if followed' },
  { value: 'spam', label: 'Spam', desc: 'Irrelevant or promotional content' },
  { value: 'other', label: 'Other', desc: 'Something else not listed above' },
];

export default function DownvoteReasonModal({ isOpen, onClose, onSubmit, targetType }) {
  const [reason, setReason] = useState('');
  const [reasonText, setReasonText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({ reason, reasonText });
    setReason('');
    setReasonText('');
    onClose();
  };

  const handleCancel = () => {
    setReason('');
    setReasonText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleCancel} />
      <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-1">
            Help improve this {targetType === 'Question' ? 'question' : 'answer'}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-5">
            Your feedback is private and only visible to the author. Select a reason for the downvote.
          </p>

          <div className="space-y-2 mb-4">
            {DOWNVOTE_REASONS.map(r => (
              <label
                key={r.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  reason === r.value
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg)]'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <span className="text-sm font-medium text-[var(--color-text)]">{r.label}</span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-1">— {r.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {(reason === 'other' || reason) && (
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder="Add more detail (optional)..."
              className="input mb-4 text-sm"
              rows={2}
              maxLength={500}
            />
          )}
        </div>

        <div className="px-6 pb-5 flex items-center justify-end gap-3">
          <button onClick={handleCancel} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason}
            className="btn-danger btn-sm disabled:opacity-50"
          >
            Submit Feedback & Downvote
          </button>
        </div>
      </div>
    </div>
  );
}