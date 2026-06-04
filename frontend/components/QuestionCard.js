'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';
import toast from 'react-hot-toast';
import DownvoteReasonModal from './DownvoteReasonModal';

export default function QuestionCard({ question }) {
  const { user } = useAuth();
  const [upvotes, setUpvotes] = useState(question.upvotes || 0);
  const [downvotes, setDownvotes] = useState(question.downvotes || 0);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [meTooCount, setMeTooCount] = useState(question.meTooCount || 0);
  const [hasMeToo, setHasMeToo] = useState(question.hasMeToo || false);
  const [meTooLoading, setMeTooLoading] = useState(false);
  const [showDownvoteModal, setShowDownvoteModal] = useState(false);
  const [pendingDownvote, setPendingDownvote] = useState(false);

  useEffect(() => {
    if (user && question._id) {
      api.get(`/votes/batch`, { ids: question._id, targetType: 'Question' })
        .then(data => setUserVote(data[question._id] || null))
        .catch(() => {});
    }
  }, [user, question._id]);

  const handleVote = async (e, voteType, reasonData = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please login to vote'); return; }
    if (loading) return;

    setLoading(true);
    try {
      const payload = { targetType: 'Question', targetId: question._id, voteType };
      if (voteType === 'downvote' && reasonData) {
        payload.reason = reasonData.reason;
        payload.reasonText = reasonData.reasonText;
      }
      await api.post('/votes', payload);
      const data = await api.get(`/votes/Question/${question._id}`);
      setUserVote(data.vote);
      const newQuestion = await api.get(`/questions/${question._id}`);
      setUpvotes(newQuestion.question.upvotes || 0);
      setDownvotes(newQuestion.question.downvotes || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownvoteWithReason = (reasonData) => {
    setPendingDownvote(true);
    handleVote({ preventDefault: () => {}, stopPropagation: () => {} }, 'downvote', reasonData);
  };

  const handleMeToo = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please login to use this feature'); return; }
    if (meTooLoading) return;

    setMeTooLoading(true);
    try {
      const data = await api.patch(`/questions/${question._id}/me-too`);
      setMeTooCount(data.meTooCount);
      setHasMeToo(data.hasMeToo);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMeTooLoading(false);
    }
  };

  const score = upvotes - downvotes;

  return (
    <div className="card-hover p-5 sm:p-6 group">
      <div className="flex gap-5">
        <div className="hidden sm:flex flex-col items-center gap-2 min-w-[56px]">
          <button
            onClick={(e) => handleVote(e, 'upvote')}
            className={`p-2 rounded-xl transition-all ${
              userVote === 'upvote' 
                ? 'bg-emerald-500/10 text-emerald-600' 
                : 'text-[var(--color-text-muted)] hover:bg-emerald-500/10 hover:text-emerald-600'
            } ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${upvotes} upvotes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <span className={`text-base font-bold ${score > 0 ? 'text-emerald-600' : score < 0 ? 'text-red-500' : 'text-[var(--color-text)]'}`}>
            {score}
          </span>
          <button
            onClick={(e) => {
              if (userVote === 'downvote') {
                handleVote(e, 'downvote');
              } else {
                e.preventDefault();
                e.stopPropagation();
                setShowDownvoteModal(true);
              }
            }}
            className={`p-2 rounded-xl transition-all ${
              userVote === 'downvote' 
                ? 'bg-red-500/10 text-red-500' 
                : 'text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-500'
            } ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${downvotes} downvotes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          <div className="w-full h-px bg-[var(--color-border)] my-1" />
          
          <span className={`text-sm font-semibold ${question.answerCount > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {question.answerCount || 0}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] -mt-1">answers</span>
          
          <button
            onClick={handleMeToo}
            className={`p-2 rounded-xl transition-all mt-1 ${
              hasMeToo 
                ? 'bg-blue-500/10 text-blue-500' 
                : 'text-[var(--color-text-muted)] hover:bg-blue-500/10 hover:text-blue-500'
            } ${meTooLoading ? 'opacity-50' : ''}`}
            disabled={meTooLoading}
            title={`${meTooCount} students have the same doubt`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          {meTooCount > 0 && (
            <span className="text-xs font-semibold text-blue-500">{meTooCount}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">
            <Link href={`/questions/${question._id}`}>
              {question.title}
            </Link>
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2 leading-relaxed">
            {truncate(question.body, 200)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {question.tagNames?.slice(0, 5).map(tag => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="badge-primary text-xs hover:opacity-80 transition-opacity"
              >
                {tag}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {question.author?._id === 'anonymous' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] flex items-center justify-center text-[10px] font-medium">?</span>
                <span>Anonymous</span>
              </span>
            ) : (
              <Link href={`/users/${question.author?.username}`} className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition-colors">
                {question.author?.avatar ? (
                  <img 
                    src={(question.author.avatar.startsWith('http') || question.author.avatar.startsWith('data:')) ? question.author.avatar : `${api.baseUrl.replace('/api', '')}${question.author.avatar}`} 
                    alt="" 
                    className="w-5 h-5 rounded-full object-cover" 
                  />
                ) : (
                  <span className="w-5 h-5 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-purple-500 text-white flex items-center justify-center text-[10px] font-bold">
                    {(question.author?.displayName || question.author?.username || '?')[0]}
                  </span>
                )}
                <span>{question.author?.displayName || question.author?.username}</span>
              </Link>
            )}
            <span>asked {formatDate(question.createdAt)}</span>
            <span className="text-[var(--color-text-muted)]">{question.viewCount || 0} views</span>
          </div>
        </div>
      </div>
      <DownvoteReasonModal
        isOpen={showDownvoteModal}
        onClose={() => setShowDownvoteModal(false)}
        onSubmit={handleDownvoteWithReason}
        targetType="Question"
      />
    </div>
  );
}