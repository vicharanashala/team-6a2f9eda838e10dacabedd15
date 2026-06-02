'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import ReportIssueModal from './ReportIssueModal';

export default function ReportIssueButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null; // Only show for logged in users

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 text-white font-semibold text-xs tracking-wider uppercase px-4 py-3 rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 border border-white/20 active:scale-95"
        title="Report a bug or site issue"
      >
        <span className="animate-pulse">🚨</span>
        <span>Report Issue</span>
      </button>

      <ReportIssueModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
