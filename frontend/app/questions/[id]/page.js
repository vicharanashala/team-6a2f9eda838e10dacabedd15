'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function QuestionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const socket = useSocket();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState('');
  const [answering, setAnswering] = useState(false);
  const [userVotes, setUserVotes] = useState({});
  const [saved, setSaved] = useState(false);
  const [recentlyPostedId, setRecentlyPostedId] = useState(null);
  const [escalateModal, setEscalateModal] = useState({ open: false });
  const [escalationReason, setEscalationReason] = useState('');
  const [solvedDoubtAnswers, setSolvedDoubtAnswers] = useState({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [confidenceLevel, setConfidenceLevel] = useState(null);

  const fetchQuestion = useCallback(async () => {
    try {
      const data = await api.get(`/questions/${id}`);
      setQuestion(data.question);
    } catch (err) {
      toast.error('Question not found');
      router.push('/questions');
    }
  }, [id, router]);

  const fetchAnswers = useCallback(async () => {
    try {
      const data = await api.get(`/answers/question/${id}`);
      setAnswers(data.answers || []);
    } catch (_) {}
  }, [id]);

  useEffect(() => {
    fetchQuestion();
    fetchAnswers();
  }, [fetchQuestion, fetchAnswers]);

  useEffect(() => {
    if (socket && id) {
      socket.emit('join:question', id);
      socket.on('answer:new', (data) => {
        if (data.answer && data.answer._id !== recentlyPostedId) {
          setAnswers(prev => [data.answer, ...prev]);
        }
        setRecentlyPostedId(null);
      });
      socket.on('meToo:updated', (data) => {
        setQuestion(prev => prev ? { ...prev, meTooCount: data.meTooCount } : prev);
      });
      socket.on('answer:solvedUpdated', (data) => {
        setAnswers(prev => prev.map(a =>
          a._id === data.answerId ? { ...a, solvedMyDoubtCount: data.solvedMyDoubtCount } : a
        ));
      });
      return () => {
        socket.emit('leave:question', id);
        socket.off('answer:new');
        socket.off('meToo:updated');
        socket.off('answer:solvedUpdated');
      };
    }
  }, [socket, id]);

  const handleVote = async (targetType, targetId, voteType) => {
    if (!user) { toast.error('Please login to vote'); return; }
    try {
      await api.post('/votes', { targetType, targetId, voteType });
      if (targetType === 'Question') {
        fetchQuestion();
      } else {
        fetchAnswers();
      }
    } catch (err) {
      toast.error(err.message || 'Vote failed');
    }
  };

  const handleSave = async () => {
    if (!user) { toast.error('Please login to save'); return; }
    try {
      if (saved) {
        await api.delete(`/users/me/saved/${id}`);
        setSaved(false);
        toast.success('Question unsaved');
      } else {
        await api.post('/users/me/saved', { questionId: id });
        setSaved(true);
        toast.success('Question saved');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMeToo = async () => {
    if (!user) { toast.error('Please login to use this feature'); return; }
    try {
      const data = await api.patch(`/questions/${id}/me-too`);
      setQuestion(prev => prev ? { ...prev, meTooCount: data.meTooCount, hasMeToo: data.hasMeToo } : prev);
      toast.success(data.hasMeToo ? 'You\'ve been added to the list' : 'Removed from the list');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSolvedMyDoubt = async (answerId) => {
    if (!user) { toast.error('Please login to use this feature'); return; }
    try {
      const data = await api.patch(`/answers/${answerId}/solved-my-doubt`);
      setSolvedDoubtAnswers(prev => ({
        ...prev,
        [answerId]: { count: data.solvedMyDoubtCount, hasSolved: data.hasSolvedMyDoubt }
      }));
      if (data.hasSolvedMyDoubt) {
        toast.success('Marked as solving your doubt!');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please login to answer'); return; }
    if (newAnswer.length < 10) { toast.error('Answer too short'); return; }

    setAnswering(true);
    try {
      const data = await api.post(`/answers/question/${id}`, { body: newAnswer, confidenceLevel });
      setRecentlyPostedId(data.answer._id);
      setAnswers(prev => [data.answer, ...prev]);
      setNewAnswer('');
      setConfidenceLevel(null);
      toast.success('Answer posted!');
    } catch (err) {
      toast.error(err.message || 'Failed to post answer');
    } finally {
      setAnswering(false);
    }
  };

  const handleAcceptAnswer = async (answerId) => {
    try {
      await api.post(`/answers/${answerId}/accept`);
      fetchQuestion();
      fetchAnswers();
      toast.success('Answer accepted');
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEscalate = async () => {
    try {
      await api.patch(`/questions/${id}/escalate`, { reason: escalationReason });
      toast.success('Question escalated. A moderator will review it.');
      setEscalateModal({ open: false });
      setEscalationReason('');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canEscalate = () => {
    if (!user) return false;
    const isModOrAdmin = user.role === 'admin' || user.role === 'moderator';
    if (question.isEscalated || question.resolutionStatus === 'escalated') return false;
    if (isModOrAdmin) return true;
    if (question.isOwner) return true;
    return false;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.delete(`/questions/${id}`);
      toast.success('Question deleted');
      router.push('/questions');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleVerify = async () => {
    try {
      await api.patch(`/questions/${id}/verify`);
      toast.success('FAQ verified');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMarkOutdated = async () => {
    const reason = prompt('Reason for marking outdated (optional):');
    if (reason === null) return;
    try {
      await api.patch(`/questions/${id}/outdated`, { reason });
      toast.success('Marked as outdated');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'QAPage',
            mainEntity: {
              '@type': 'Question',
              name: question.title,
              text: question.body,
              dateCreated: question.createdAt,
              author: { '@type': 'Person', name: question.author?.displayName || question.author?.username },
              answerCount: question.answerCount,
              upvoteCount: question.upvotes,
              acceptedAnswer: question.acceptedAnswer ? {
                '@type': 'Answer',
                text: question.acceptedAnswer.body,
                dateCreated: question.acceptedAnswer.createdAt,
                author: { '@type': 'Person', name: question.acceptedAnswer.author?.displayName || question.acceptedAnswer.author?.username },
                upvoteCount: question.acceptedAnswer.upvotes,
                text: question.acceptedAnswer.body,
              } : undefined,
              suggestedAnswer: answers.filter(a => !a.isAccepted).slice(0, 5).map(a => ({
                '@type': 'Answer',
                text: a.body,
                dateCreated: a.createdAt,
                author: { '@type': 'Person', name: a.author?.displayName || a.author?.username },
                upvoteCount: a.upvotes,
              })),
            },
          })
        }}
      />
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Duplicate Notice */}
      {question.isDuplicate && question.duplicateOf && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">This question has been marked as a duplicate</span>
          </div>
          <Link href={`/questions/${question.duplicateOf._id || question.duplicateOf}`} className="text-primary-600 hover:text-primary-700 text-sm mt-1 inline-block">
            View the original question →
          </Link>
        </div>
      )}

      {/* Closed Notice */}
      {question.status === 'closed' && !question.isDuplicate && (
        <div className="mb-4 p-4 bg-gray-100 border border-gray-300 rounded-lg">
          <div className="flex items-center gap-2 text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-semibold">This question is closed: {question.closedReason || 'No reason given'}</span>
          </div>
        </div>
      )}

      {/* Outdated Notice */}
      {question.isFAQ && question.isOutdated && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2 text-orange-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">This FAQ may be outdated</span>
          </div>
          {question.outdatedReason && (
            <p className="text-sm text-orange-700 mt-1">{question.outdatedReason}</p>
          )}
          <p className="text-xs text-orange-600 mt-1">Last verified: {question.lastVerifiedAt ? formatDate(question.lastVerifiedAt) : 'Never'}</p>
        </div>
      )}

      {/* FAQ Verified Badge */}
      {question.isFAQ && !question.isOutdated && question.lastVerifiedAt && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Verified on {formatDate(question.lastVerifiedAt)}</span>
        </div>
      )}

      {/* Question Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className={`text-2xl sm:text-3xl font-bold text-gray-900 ${question.status === 'closed' ? 'opacity-60' : ''}`}>{question.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSave} className="btn-secondary btn-sm">
              {saved ? 'Saved' : 'Save'}
            </button>
            {(user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={handleDelete} className="btn-danger btn-sm">Delete</button>
            )}
            {question.isFAQ && (user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={handleVerify} className="btn-secondary btn-sm">Verify FAQ</button>
            )}
            {question.isFAQ && (user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={() => handleMarkOutdated()} className="btn-secondary btn-sm">Mark Outdated</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {question.tagNames?.map(tag => (
            <Link key={tag} href={`/tags/${tag}`} className="badge-primary">{tag}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
          {question.author?._id === 'anonymous' ? (
            <span className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-medium">?</div>
              <span>Anonymous Student</span>
            </span>
          ) : (
            <Link href={`/users/${question.author?.username}`} className="flex items-center gap-1 hover:text-primary-600">
              <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-medium">
                {(question.author?.displayName || question.author?.username || '?')[0]}
              </div>
              <span>{question.author?.displayName || question.author?.username}</span>
            </Link>
          )}
          <span>asked {formatDate(question.createdAt)}</span>
          <span>{question.viewCount} views</span>
          {canEscalate() && (
            <button onClick={() => setEscalateModal({ open: true })} className="ml-2 text-orange-600 hover:text-orange-700 font-medium text-xs border border-orange-300 rounded px-2 py-0.5">
              Escalate Query
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Vote sidebar */}
        <div className="hidden sm:flex flex-col items-center gap-2">
          <button onClick={() => handleVote('Question', id, 'upvote')} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <span className="font-bold text-lg text-gray-900">{question.upvotes - question.downvotes}</span>
          <button onClick={() => handleVote('Question', id, 'downvote')} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Question body */}
        <div className="flex-1 min-w-0">
          <div className="card p-6 mb-4">
            <MarkdownRenderer content={question.body} />
          </div>

          {/* Answer count */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {question.answerCount || 0} {(question.answerCount || 0) === 1 ? 'Answer' : 'Answers'}
            </h2>
            <button
              onClick={handleMeToo}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                question.hasMeToo
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Me Too {question.meTooCount > 0 && `(${question.meTooCount})`}
            </button>
          </div>

          {/* Answers */}
          {answers.length === 0 ? (
            <div className="card p-8 text-center mb-6">
              <p className="text-gray-500">No answers yet. Be the first to answer!</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {answers.map(answer => (
                <div key={answer._id} className={`card p-6 ${answer.isAccepted ? 'border-green-300 ring-1 ring-green-200' : ''}`}>
                  <div className="flex gap-4">
                    <div className="hidden sm:flex flex-col items-center gap-1">
                      <button onClick={() => handleVote('Answer', answer._id, 'upvote')} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <span className="font-semibold text-sm">{answer.upvotes - answer.downvotes}</span>
                      <button onClick={() => handleVote('Answer', answer._id, 'downvote')} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      <MarkdownRenderer content={answer.body} />
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Link href={`/users/${answer.author?.username}`} className="flex items-center gap-1 hover:text-primary-600">
                            <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-medium">
                              {(answer.author?.displayName || answer.author?.username || '?')[0]}
                            </div>
                            <span>{answer.author?.displayName || answer.author?.username}</span>
                          </Link>
                          <span>answered {formatDate(answer.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {answer.isOfficial && <span className="badge-green">Official</span>}
                          {answer.isAccepted && <span className="badge-green">Accepted</span>}
                          {answer.solvedMyDoubtCount >= 5 && <span className="badge-blue">Helpful ({answer.solvedMyDoubtCount})</span>}
                          {answer.confidenceLevel === 'low' && (
                            <span className="badge-gray flex items-center gap-1">
                              <span>🤔</span><span>I think so</span>
                            </span>
                          )}
                          {answer.confidenceLevel === 'medium' && (
                            <span className="badge-yellow flex items-center gap-1">
                              <span>👍</span><span>Pretty sure</span>
                            </span>
                          )}
                          {answer.confidenceLevel === 'high' && (
                            <span className="badge-green flex items-center gap-1">
                              <span>💯</span><span>I know this</span>
                            </span>
                          )}
                          <button
                            onClick={() => handleSolvedMyDoubt(answer._id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              solvedDoubtAnswers[answer._id]?.hasSolved
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Solved My Doubt {solvedDoubtAnswers[answer._id]?.count > 0 && `(${solvedDoubtAnswers[answer._id].count})`}
                          </button>
                          {(user?.role === 'admin' || user?.role === 'moderator') && !answer.isAccepted && (
                            <button onClick={() => handleAcceptAnswer(answer._id)} className="btn-secondary btn-sm">
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Answer form */}
          {user ? (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Answer</h3>
              <form onSubmit={handleSubmitAnswer}>
                <textarea
                  rows={6}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="input mb-3 font-mono text-sm"
                  placeholder="Write your answer in Markdown..."
                  maxLength={50000}
                />

                {/* Confidence Level Picker */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">How confident are you?</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'low', label: 'I think so', icon: '🤔', color: 'gray' },
                      { value: 'medium', label: 'Pretty sure', icon: '👍', color: 'yellow' },
                      { value: 'high', label: 'I know this', icon: '💯', color: 'green' },
                    ].map(({ value, label, icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setConfidenceLevel(confidenceLevel === value ? null : value)}
                        className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition-colors border ${
                          confidenceLevel === value
                            ? color === 'gray' ? 'bg-gray-200 border-gray-400 text-gray-800' :
                              color === 'yellow' ? 'bg-yellow-100 border-yellow-400 text-yellow-800' :
                              'bg-green-100 border-green-400 text-green-800'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={answering} className="btn-primary">
                  {answering ? 'Posting...' : 'Post Answer'}
                </button>
              </form>
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-gray-500">
                <Link href={`/auth?mode=login&redirect=/questions/${id}`} className="text-primary-600 hover:text-primary-700 font-medium">
                  Login
                </Link> to answer this question
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Escalate Question Modal */}
      {escalateModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Escalate Question</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your question has had no responses for 24 hours. Escalating will notify moderators to review and potentially highlight your question.
            </p>
            <textarea
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              className="input mb-4 w-full"
              placeholder="Reason for escalation (optional)"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setEscalateModal({ open: false }); setEscalationReason(''); }} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleEscalate} className="btn-warning">
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="confetti-animation">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)],
                }}
              />
            ))}
          </div>
          <div className="bg-green-500 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg animate-bounce">
            Your doubt is resolved!
          </div>
        </div>
      )}
    </div>
    </>
  );
}
