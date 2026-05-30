'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function QuestionCard({ question }) {
  const { user } = useAuth();
  const [upvotes, setUpvotes] = useState(question.upvotes || 0);
  const [downvotes, setDownvotes] = useState(question.downvotes || 0);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [meTooCount, setMeTooCount] = useState(question.meTooCount || 0);
  const [hasMeToo, setHasMeToo] = useState(question.hasMeToo || false);
  const [meTooLoading, setMeTooLoading] = useState(false);

  useEffect(() => {
    if (user && question._id) {
      api.get(`/votes/batch`, { ids: question._id, targetType: 'Question' })
        .then(data => setUserVote(data[question._id] || null))
        .catch(() => {});
    }
  }, [user, question._id]);

  const handleVote = async (e, voteType) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please login to vote'); return; }
    if (loading) return;

    setLoading(true);
    try {
      await api.post('/votes', { targetType: 'Question', targetId: question._id, voteType });
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

  return (
    <div className="card-hover p-4 sm:p-6">
      <div className="flex gap-4">
        <div className="hidden sm:flex flex-col items-center gap-1 text-sm min-w-[60px]">
          <button
            onClick={(e) => handleVote(e, 'upvote')}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${userVote === 'upvote' ? 'text-green-600' : 'text-gray-400 dark:text-gray-500 hover:text-green-600'} ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${upvotes} likes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <span className={`font-semibold ${upvotes - downvotes > 0 ? 'text-green-600' : upvotes - downvotes < 0 ? 'text-red-600' : 'text-[var(--color-text)]'}`}>
            {upvotes - downvotes}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]" title={`${upvotes} likes, ${downvotes} dislikes`}>score</span>
          <button
            onClick={(e) => handleVote(e, 'downvote')}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${userVote === 'downvote' ? 'text-red-600' : 'text-gray-400 dark:text-gray-500 hover:text-red-600'} ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${downvotes} dislikes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <span className={`font-semibold ${question.answerCount > 0 ? 'text-green-600' : 'text-[var(--color-text-secondary)]'}`}>
            {question.answerCount || 0}
          </span>
          <span className="text-[var(--color-text-secondary)] text-xs">answers</span>
          <span className="text-gray-400 dark:text-gray-500 text-xs">{question.viewCount || 0} views</span>
          <button
            onClick={handleMeToo}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 mt-1 ${hasMeToo ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600'} ${meTooLoading ? 'opacity-50' : ''}`}
            disabled={meTooLoading}
            title={`${meTooCount} students have the same doubt`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          <span className={`text-xs font-medium ${meTooCount > 0 ? 'text-blue-600' : 'text-[var(--color-text-secondary)]'}`}>
            {meTooCount > 0 ? `${meTooCount}` : ''}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
            <Link href={`/questions/${question._id}`} className="hover:text-primary-600 transition-colors">
              {question.title}
            </Link>
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
            {truncate(question.body, 200)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {question.tagNames?.slice(0, 5).map(tag => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="badge-primary text-xs hover:bg-primary-200 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {question.author?._id === 'anonymous' ? (
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)] flex items-center justify-center text-[10px] font-medium">?</span>
                <span>Anonymous Student</span>
              </span>
            ) : (
              <Link href={`/users/${question.author?.username}`} className="flex items-center gap-1 hover:text-primary-600">
                {question.author?.avatar ? (
                  <img src={question.author?.avatar} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-medium">
                    {(question.author?.displayName || question.author?.username || '?')[0]}
                  </span>
                )}
                <span>{question.author?.displayName || question.author?.username}</span>
              </Link>
            )}
            <span>asked {formatDate(question.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}