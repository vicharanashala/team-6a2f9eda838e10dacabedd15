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

  return (
    <div className="card-hover p-4 sm:p-6">
      <div className="flex gap-4">
        <div className="hidden sm:flex flex-col items-center gap-1 text-sm min-w-[60px]">
          <button
            onClick={(e) => handleVote(e, 'upvote')}
            className={`p-1 rounded hover:bg-gray-100 ${userVote === 'upvote' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'} ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${upvotes} likes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <span className={`font-semibold ${upvotes - downvotes > 0 ? 'text-green-600' : upvotes - downvotes < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {upvotes - downvotes}
          </span>
          <span className="text-xs text-gray-500" title={`${upvotes} likes, ${downvotes} dislikes`}>score</span>
          <button
            onClick={(e) => handleVote(e, 'downvote')}
            className={`p-1 rounded hover:bg-gray-100 ${userVote === 'downvote' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'} ${loading ? 'opacity-50' : ''}`}
            disabled={loading}
            title={`${downvotes} dislikes`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <span className={`font-semibold ${question.answerCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {question.answerCount || 0}
          </span>
          <span className="text-gray-500 text-xs">answers</span>
          <span className="text-gray-400 text-xs">{question.viewCount || 0} views</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            <Link href={`/questions/${question._id}`} className="hover:text-primary-600 transition-colors">
              {question.title}
            </Link>
          </h2>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
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
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
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
            <span>asked {formatDate(question.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}