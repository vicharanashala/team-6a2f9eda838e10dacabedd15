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
  const [downvoteModal, setDownvoteModal] = useState({ open: false, targetType: null, targetId: null });
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonText, setReasonText] = useState('');

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
        if (data.answer) {
          setAnswers(prev => [data.answer, ...prev]);
        }
      });
      return () => {
        socket.emit('leave:question', id);
        socket.off('answer:new');
      };
    }
  }, [socket, id]);

  const handleVote = async (targetType, targetId, voteType, reason, reasonText) => {
    if (!user) { toast.error('Please login to vote'); return; }
    if (voteType === 'downvote' && !reason) {
      setDownvoteModal({ open: true, targetType, targetId });
      return;
    }
    try {
      await api.post('/votes', { targetType, targetId, voteType, reason, reasonText });
      setDownvoteModal({ open: false, targetType: null, targetId: null });
      setSelectedReason('');
      setReasonText('');
      if (targetType === 'Question') {
        fetchQuestion();
      } else {
        fetchAnswers();
      }
    } catch (err) {
      toast.error(err.message || 'Vote failed');
    }
  };

  const submitDownvote = () => {
    handleVote(downvoteModal.targetType, downvoteModal.targetId, 'downvote', selectedReason, reasonText);
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

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please login to answer'); return; }
    if (newAnswer.length < 10) { toast.error('Answer too short'); return; }

    setAnswering(true);
    try {
      const data = await api.post(`/answers/question/${id}`, { body: newAnswer });
      setAnswers(prev => [data.answer, ...prev]);
      setNewAnswer('');
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
    } catch (err) {
      toast.error(err.message);
    }
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

  const handleConfirmResolved = async () => {
    try {
      await api.patch(`/questions/${id}/confirm-resolution`);
      toast.success('Thanks for confirming! Glad we could help.');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEscalate = async () => {
    const reason = prompt('Why is the answer not working for you?');
    if (reason === null) return;
    try {
      await api.patch(`/questions/${id}/escalate`, { reason });
      toast.success('Question escalated. A moderator will review it.');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResolveEscalation = async () => {
    const note = prompt('Resolution note (optional):');
    try {
      await api.patch(`/questions/${id}/escalate/resolve`, { resolutionNote: note });
      toast.success('Escalation resolved');
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

      {/* Resolution Tracking - for question author with accepted answer */}
      {user?._id === question.author?._id && question.acceptedAnswer && question.resolutionStatus === 'unresolved' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-800 mb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Did this answer resolve your problem?</span>
              </div>
              <p className="text-sm text-blue-700">Your question has an accepted answer. Please let us know if it actually solved your issue.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleConfirmResolved} className="btn-primary btn-sm bg-green-600 hover:bg-green-700">
                Yes, Resolved
              </button>
              <button onClick={handleEscalate} className="btn-secondary btn-sm">
                Still Need Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalated Notice */}
      {question.resolutionStatus === 'escalated' && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 text-purple-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-semibold">This question has been escalated</span>
          </div>
          {question.escalationReason && (
            <p className="text-sm text-purple-700 mt-1">Reason: {question.escalationReason}</p>
          )}
          {user?.role === 'admin' || user?.role === 'moderator' ? (
            <button onClick={handleResolveEscalation} className="mt-2 btn-secondary btn-sm">
              Mark as Resolved
            </button>
          ) : (
            <p className="text-xs text-purple-600 mt-1">A moderator will review your case soon.</p>
          )}
        </div>
      )}

      {/* Resolved by Student Badge */}
      {question.resolvedByStudent && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Marked as resolved by student on {formatDate(question.resolvedAtStudent)}</span>
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
            {(user?._id === question.author?._id || user?.role === 'admin') && (
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
          <Link href={`/users/${question.author?.username}`} className="flex items-center gap-1 hover:text-primary-600">
            <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-medium">
              {(question.author?.displayName || question.author?.username || '?')[0]}
            </div>
            <span>{question.author?.displayName || question.author?.username}</span>
          </Link>
          <span>asked {formatDate(question.createdAt)}</span>
          <span>{question.viewCount} views</span>
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
                          {question.author?._id === user?._id && !answer.isAccepted && (
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

      {/* Downvote Reason Modal */}
      {downvoteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Why are you downvoting?</h3>
            <div className="space-y-2 mb-4">
              {[
                { value: 'incorrect', label: 'Incorrect information' },
                { value: 'incomplete', label: 'Incomplete answer' },
                { value: 'unclear', label: 'Unclear or confusing' },
                { value: 'harmful', label: 'Harmful or unsafe' },
                { value: 'spam', label: 'Spam or irrelevant' },
                { value: 'other', label: 'Other' },
              ].map(r => (
                <label key={r.value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={selectedReason === r.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="text-primary-600"
                  />
                  <span className="text-sm text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
            {selectedReason === 'other' && (
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Explain why (optional)"
                className="input w-full mb-4"
                rows={3}
              />
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDownvoteModal({ open: false, targetType: null, targetId: null }); setSelectedReason(''); setReasonText(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={submitDownvote} className="btn-danger" disabled={!selectedReason}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
