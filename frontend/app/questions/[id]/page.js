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
import DownvoteReasonModal from '@/components/DownvoteReasonModal';

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
  const [showDownvoteModal, setShowDownvoteModal] = useState({ open: false, targetType: null, targetId: null });
  const [downvoteFeedback, setDownvoteFeedback] = useState({ question: [], answers: {} });
  const [showAddToFAQModal, setShowAddToFAQModal] = useState({ open: false, answerId: null });
  const [faqs, setFaqs] = useState([]);
  const [selectedFAQ, setSelectedFAQ] = useState('');
  const [addingToFAQ, setAddingToFAQ] = useState(false);

  // States and helpers for Answer Attachments & Links
  const [answerAttachments, setAnswerAttachments] = useState([]);
  const [answerLinks, setAnswerLinks] = useState([]);
  const [answerLinkForm, setAnswerLinkForm] = useState({ title: '', url: '' });

  const handleAnswerFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds the 2MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAnswerAttachments(prev => [
          ...prev,
          {
            filename: file.name,
            content: reader.result, // base64 string
            mimetype: file.type,
            size: file.size
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = null; // Reset input
  };

  const removeAnswerAttachment = (index) => {
    setAnswerAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  const addAnswerLink = () => {
    if (!answerLinkForm.url) return;
    let url = answerLinkForm.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    setAnswerLinks(prev => [...prev, { title: answerLinkForm.title.trim() || url, url }]);
    setAnswerLinkForm({ title: '', url: '' });
  };

  const removeAnswerLink = (index) => {
    setAnswerLinks(prev => prev.filter((_, idx) => idx !== index));
  };

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

  const fetchDownvoteFeedback = useCallback(async () => {
    if (!user || !id) return;
    try {
      const qData = await api.get(`/votes/feedback/Question/${id}`);
      if (qData.feedback && qData.feedback.length > 0) {
        setDownvoteFeedback(prev => ({ ...prev, question: qData.feedback }));
      }
    } catch (_) {}
  }, [user, id]);

  useEffect(() => {
    fetchDownvoteFeedback();
  }, [fetchDownvoteFeedback]);

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

  const handleVote = async (targetType, targetId, voteType, reasonData = null) => {
    if (!user) {
      toast.error('Please login to vote');
      router.push('/auth?mode=login');
      return;
    }
    try {
      const payload = { targetType, targetId, voteType };
      if (voteType === 'downvote' && reasonData) {
        payload.reason = reasonData.reason;
        payload.reasonText = reasonData.reasonText;
      }
      await api.post('/votes', payload);
      if (targetType === 'Question') {
        fetchQuestion();
      } else {
        fetchAnswers();
      }
    } catch (err) {
      toast.error(err.message || 'Vote failed');
    }
  };

  const openDownvoteModal = (targetType, targetId) => {
    if (!user) {
      toast.error('Please login to vote');
      router.push('/auth?mode=login');
      return;
    }
    setShowDownvoteModal({ open: true, targetType, targetId });
  };

  const submitDownvoteWithReason = (reasonData) => {
    handleVote(showDownvoteModal.targetType, showDownvoteModal.targetId, 'downvote', reasonData);
    setShowDownvoteModal({ open: false, targetType: null, targetId: null });
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please login to save');
      router.push('/auth?mode=login');
      return;
    }
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

  const handleReportPost = async (targetId, postType = 'Question') => {
    if (!user) {
      toast.error('Please login to report content');
      router.push('/auth?mode=login');
      return;
    }
    const reason = prompt('Please specify a reason for reporting (e.g. spam, abuse, duplicate):');
    if (!reason) return;
    try {
      await api.post(`/posts/${targetId}/report`, { reason });
      toast.success('Report submitted successfully. Thank you for keeping the community safe!');
      if (postType === 'Question') {
        fetchQuestion();
      } else {
        fetchAnswers();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    }
  };

  const handleSelfEscalate = async () => {
    try {
      const res = await api.patch(`/questions/${id}/urgent`);
      setQuestion(res.question);
      toast.success('Your question has been escalated to urgent status!');
    } catch (err) {
      toast.error(err.message || 'Failed to escalate question');
    }
  };

  const handleMeToo = async () => {
    if (!user) {
      toast.error('Please login to use this feature');
      router.push('/auth?mode=login');
      return;
    }
    try {
      const data = await api.patch(`/questions/${id}/me-too`);
      setQuestion(prev => prev ? { ...prev, meTooCount: data.meTooCount, hasMeToo: data.hasMeToo } : prev);
      toast.success(data.hasMeToo ? 'You\'ve been added to the list' : 'Removed from the list');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSolvedMyDoubt = async (answerId) => {
    if (!user) {
      toast.error('Please login to use this feature');
      router.push('/auth?mode=login');
      return;
    }
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
    if (!user) {
      toast.error('Please login to answer');
      router.push('/auth?mode=login');
      return;
    }
    if (newAnswer.length < 10) { toast.error('Answer too short'); return; }

    setAnswering(true);
    try {
      const data = await api.post(`/answers/question/${id}`, {
        body: newAnswer,
        confidenceLevel,
        attachments: answerAttachments,
        links: answerLinks
      });
      setRecentlyPostedId(data.answer._id);
      setAnswers(prev => [data.answer, ...prev]);
      setNewAnswer('');
      setConfidenceLevel(null);
      setAnswerAttachments([]);
      setAnswerLinks([]);
      setAnswerLinkForm({ title: '', url: '' });
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

  const handleUnacceptAnswer = async (answerId) => {
    try {
      await api.post(`/answers/${answerId}/unaccept`);
      await handleRemoveFromFAQ(answerId);
      fetchQuestion();
      fetchAnswers();
      toast.success('Answer unaccepted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!confirm('Are you sure you want to delete this answer?')) return;
    try {
      await api.delete(`/answers/${answerId}`);
      toast.success('Answer deleted');
      fetchAnswers();
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
    // Escalate must show to users who raised the question only
    const isOwner = question.isOwner || (question.author && (question.author._id === user._id || question.author === user._id));
    if (!isOwner) return false;
    if (question.isEscalated || question.resolutionStatus === 'escalated') return false;

    // Check if there are answers from other users
    const hasOtherAnswers = answers.some(a => a.author && a.author._id !== user._id && !a.isDeleted);
    if (hasOtherAnswers) return false;

    return true;
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

  const handleClearVerify = async () => {
    try {
      await api.patch(`/questions/${id}/verify/clear`);
      await handleRemoveFromFAQ();
      toast.success('FAQ verification cleared');
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
      await handleRemoveFromFAQ();
      toast.success('Marked as outdated');
      fetchQuestion();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openAddToFAQModal = (answerId = null) => {
    setShowAddToFAQModal({ open: true, answerId });
    setSelectedFAQ('');
    api.get('/faqs', { limit: 100 }).then(data => {
      setFaqs(data.faqs || []);
    }).catch(() => {});
  };

  const handleAddToFAQ = async () => {
    if (!selectedFAQ) { toast.error('Please select an FAQ'); return; }
    setAddingToFAQ(true);
    try {
      await api.patch(`/questions/${id}/add-to-faq`, {
        faqId: selectedFAQ,
        answerId: showAddToFAQModal.answerId,
      });
      toast.success('Added to FAQ');
      setShowAddToFAQModal({ open: false, answerId: null });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingToFAQ(false);
    }
  };

  const handleRemoveFromFAQ = async (answerId = null) => {
    try {
      await api.patch(`/questions/${id}/remove-from-faq`, { answerId });
      toast.success('Removed from FAQ');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--color-border)] rounded w-3/4" />
          <div className="h-4 bg-[var(--color-border)] rounded w-full" />
          <div className="h-4 bg-[var(--color-border)] rounded w-2/3" />
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
      {/* Visibility Status Banners */}
      {question.visibility === 'pending' && user && (user._id === question.author?._id || user.role === 'admin' || user.role === 'moderator') && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold text-sm">Your question is pending moderation. It will be visible to everyone once approved by a moderator.</span>
          </div>
        </div>
      )}

      {question.visibility === 'hidden' && user && (user._id === question.author?._id || user.role === 'admin' || user.role === 'moderator') && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="font-semibold text-sm">This question has been hidden by moderators.</span>
          </div>
        </div>
      )}

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
        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
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

      {/* Escalation Status Banner */}
      {question.isEscalated && (
        <div className={`mb-4 p-4 border rounded-lg shadow-sm ${
          question.resolutionStatus === 'escalated'
            ? 'bg-amber-50/90 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400'
            : 'bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-green-400'
        }`}>
          <div className="flex items-start gap-3">
            {question.resolutionStatus === 'escalated' ? (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {question.resolutionStatus === 'escalated' 
                  ? 'This doubt has been escalated' 
                  : 'Escalation resolved'}
              </p>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {question.resolutionStatus === 'escalated'
                  ? `Your query is escalated to the moderator queue. Escalation Reason: "${question.escalationReason || 'No response received within 24 hours'}"`
                  : 'A moderator has reviewed and addressed this escalation.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Detection Banners */}
      {question.anomalySeverity === 'high' && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg shadow-sm animate-pulse">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold text-sm">Your query has been flagged as urgent. Our team has been notified and will respond shortly.</span>
          </div>
        </div>
      )}

      {question.anomalySeverity === 'medium' && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-sm">Your query is in our review queue. You'll hear back soon.</span>
          </div>
        </div>
      )}

      {user && (question.author?._id === user._id || question.author === user._id) && 
        (question.anomalySeverity === 'low' || question.anomalySeverity === 'none' || !question.anomalySeverity) && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Is this issue blocking your progress? You can self-escalate it.</span>
          </div>
          <button
            onClick={handleSelfEscalate}
            className="btn-primary btn-sm px-4 py-1.5 text-xs font-semibold shrink-0"
          >
            This is urgent
          </button>
        </div>
      )}

      {/* Question Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className={`text-2xl sm:text-3xl font-bold text-[var(--color-text)] ${question.status === 'closed' ? 'opacity-60' : ''}`}>{question.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSave} className="btn-secondary btn-sm">
              {saved ? 'Saved' : 'Save'}
            </button>
            {user?.id !== (question.author?._id || question.author) && (
              <button onClick={() => handleReportPost(question._id, 'Question')} className="btn-secondary btn-sm text-red-600 border-red-300 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20">
                Report
              </button>
            )}
            {(user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={handleDelete} className="btn-danger btn-sm">Delete</button>
            )}
            {question.isFAQ && (user?.role === 'admin' || user?.role === 'moderator') && !question.lastVerifiedAt && (
              <button onClick={handleVerify} className="btn-secondary btn-sm">Verify FAQ</button>
            )}
            {question.isFAQ && (user?.role === 'admin' || user?.role === 'moderator') && question.lastVerifiedAt && (
              <button onClick={handleClearVerify} className="btn-secondary btn-sm text-orange-600 border-orange-300 hover:bg-orange-50">Clear Verification</button>
            )}
            {question.isFAQ && (user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={() => handleMarkOutdated()} className="btn-secondary btn-sm">Mark Outdated</button>
            )}
            {(user?.role === 'admin' || user?.role === 'moderator') && (
              <button onClick={() => openAddToFAQModal(null)} className="btn-secondary btn-sm">Add to FAQ</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {question.tagNames?.map(tag => (
            <Link key={tag} href={`/tags/${tag}`} className="badge-primary">{tag}</Link>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-sm text-[var(--color-text-secondary)]">
          {question.author?._id === 'anonymous' ? (
            <span className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center text-[10px] font-medium">?</div>
              <span>Anonymous Student</span>
            </span>
          ) : (
            <Link href={`/users/${question.author?.username}`} className="flex items-center gap-1.5 hover:text-primary-600 transition-colors">
              {question.author?.avatar ? (
                <img 
                  src={(question.author.avatar.startsWith('http') || question.author.avatar.startsWith('data:')) ? question.author.avatar : `${api.baseUrl.replace('/api', '')}${question.author.avatar}`} 
                  alt="" 
                  className="w-5 h-5 rounded-full object-cover" 
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-medium">
                  {(question.author?.displayName || question.author?.username || '?')[0]}
                </div>
              )}
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

        {downvoteFeedback.question.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-red-800 dark:text-red-200">
                You received {downvoteFeedback.question.length} feedback{downvoteFeedback.question.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-2">
              {downvoteFeedback.question.map((f, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-red-700 dark:text-red-300 capitalize">{f.reason}: </span>
                  <span className="text-red-600 dark:text-red-400">{f.reasonText || 'No additional details'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Vote sidebar */}
        <div className="hidden sm:flex flex-col items-center gap-2">
          <button onClick={() => handleVote('Question', id, 'upvote')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-green-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <span className="font-bold text-lg text-[var(--color-text)]">{question.upvotes - question.downvotes}</span>
          <button onClick={() => openDownvoteModal('Question', id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Question body */}
        <div className="flex-1 min-w-0">
          <div className="card p-6 mb-4">
            <MarkdownRenderer content={question.body} />
          </div>

          {/* Question attachments & links */}
          {(question.attachments?.length > 0 || question.links?.length > 0) && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/40 border border-[var(--color-border)] rounded-xl space-y-3 mb-6">
              {question.attachments?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Attached Files</h4>
                  <div className="flex flex-wrap gap-2">
                    {question.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.content}
                        download={file.filename}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 transition-colors"
                      >
                        <span>📁</span>
                        <span className="truncate max-w-[200px]">{file.filename}</span>
                        {file.size && <span className="text-[10px] text-[var(--color-text-secondary)]">({(file.size / 1024).toFixed(1)} KB)</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {question.links?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Reference Links</h4>
                  <div className="flex flex-wrap gap-2">
                    {question.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-lg text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 transition-colors"
                      >
                        <span>🔗</span>
                        <span className="truncate max-w-[200px]">{link.title || link.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Answer count */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {question.answerCount || 0} {(question.answerCount || 0) === 1 ? 'Answer' : 'Answers'}
            </h2>
            <button
              onClick={handleMeToo}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                question.hasMeToo
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-300'
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
              <p className="text-[var(--color-text-secondary)]">No answers yet. Be the first to answer!</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {answers.map(answer => {
                const isAiBot = answer.isOfficial && answer.body && answer.body.includes('PrashnaSarathi AI Bot');
                return (
                <div key={answer._id} className={`card p-6 ${answer.isAccepted ? 'border-green-300 ring-1 ring-green-200' : isAiBot ? 'border-purple-500/40 ring-1 ring-purple-400/20' : ''}`}>
                  <div className="flex gap-4">
                    <div className="hidden sm:flex flex-col items-center gap-1">
                      <button onClick={() => handleVote('Answer', answer._id, 'upvote')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-green-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <span className="font-semibold text-sm">{answer.upvotes - answer.downvotes}</span>
                      <button onClick={() => openDownvoteModal('Answer', answer._id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      {/* AI Bot Answer Header */}
                      {answer.isOfficial && answer.body && answer.body.includes('PrashnaSarathi AI Bot') && (
                        <div className="mb-3 -mx-2 px-3 py-2.5 bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-xl flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                            <span className="text-sm">🤖</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-purple-300 leading-none">PrashnaSarathi AI Bot</p>
                            <p className="text-[10px] text-purple-400/80 mt-0.5 leading-none">AI-generated · Based on official knowledge base</p>
                          </div>
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">Auto Answer</span>
                        </div>
                      )}
                      <MarkdownRenderer content={answer.body} />

                      {/* Answer attachments & links */}
                      {(answer.attachments?.length > 0 || answer.links?.length > 0) && (
                        <div className="mt-3 p-3 bg-gray-50/50 dark:bg-gray-800/20 border border-[var(--color-border)] rounded-lg space-y-2">
                          {answer.attachments?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {answer.attachments.map((file, idx) => (
                                <a
                                  key={idx}
                                  href={file.content}
                                  download={file.filename}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-md text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 transition-colors"
                                >
                                  <span>📁</span>
                                  <span className="truncate max-w-[150px]">{file.filename}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          {answer.links?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {answer.links.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-md text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 transition-colors"
                                >
                                  <span>🔗</span>
                                  <span className="truncate max-w-[150px]">{link.title || link.url}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <Link href={`/users/${answer.author?.username}`} className="flex items-center gap-1.5 hover:text-primary-600 transition-colors">
                            {answer.author?.avatar ? (
                              <img 
                                src={(answer.author.avatar.startsWith('http') || answer.author.avatar.startsWith('data:')) ? answer.author.avatar : `${api.baseUrl.replace('/api', '')}${answer.author.avatar}`} 
                                alt="" 
                                className="w-5 h-5 rounded-full object-cover" 
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center text-[10px] font-medium">
                                {(answer.author?.displayName || answer.author?.username || '?')[0]}
                              </div>
                            )}
                            <span>{answer.author?.displayName || answer.author?.username}</span>
                          </Link>
                          <span>answered {formatDate(answer.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
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
                          {answer.author?._id !== user?._id && (
                            <button
                              onClick={() => handleSolvedMyDoubt(answer._id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                solvedDoubtAnswers[answer._id]?.hasSolved
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-300'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Solved My Doubt {solvedDoubtAnswers[answer._id]?.count > 0 && `(${solvedDoubtAnswers[answer._id].count})`}
                            </button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'moderator') && !answer.isAccepted && (
                            <button onClick={() => handleAcceptAnswer(answer._id)} className="btn-secondary btn-sm">
                              Accept
                            </button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'moderator' || question.author?._id === user?.id) && answer.isAccepted && (
                            <button onClick={() => handleUnacceptAnswer(answer._id)} className="btn-secondary btn-sm text-orange-600 border-orange-300 hover:bg-orange-50">
                              Unaccept
                            </button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'moderator') && (
                            <button onClick={() => openAddToFAQModal(answer._id)} className="btn-secondary btn-sm">
                              Add to FAQ
                            </button>
                          )}
                          {user && (user?.role === 'admin' || user?.role === 'moderator' || user?.id === answer.author?._id) && (
                            <button onClick={() => handleDeleteAnswer(answer._id)} className="btn-danger btn-sm">
                              Delete
                            </button>
                          )}
                          {user && user?.id !== answer.author?._id && (
                            <button onClick={() => handleReportPost(answer._id, 'Answer')} className="btn-secondary btn-sm text-red-600 border-red-300 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20">
                              Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}

            </div>
          )}

          {/* Answer form */}
          {user ? (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Your Answer</h3>
              <form onSubmit={handleSubmitAnswer}>
                <textarea
                  rows={6}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="input mb-3 font-mono text-sm"
                  placeholder="Write your answer in Markdown..."
                  maxLength={50000}
                />

                {/* Attachments Section */}
                <div className="border border-[var(--color-border)] rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/20 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[var(--color-text)]">Attachments (Optional)</label>
                    <span className="text-[10px] text-[var(--color-text-secondary)]">Max 2MB per file</span>
                  </div>
                  
                  <input
                    type="file"
                    multiple
                    onChange={handleAnswerFileChange}
                    className="hidden"
                    id="answer-file-upload"
                  />
                  <label
                    htmlFor="answer-file-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium text-[var(--color-text)] rounded-md cursor-pointer transition-colors shadow-sm"
                  >
                    <span>📁</span> Choose Files
                  </label>

                  {answerAttachments.length > 0 && (
                    <div className="space-y-1">
                      {answerAttachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-md text-[11px]">
                          <span className="font-medium text-[var(--color-text)] truncate max-w-[200px]">{file.filename}</span>
                          <button
                            type="button"
                            onClick={() => removeAnswerAttachment(idx)}
                            className="text-red-500 hover:text-red-750 font-bold px-1.5"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reference Links Section */}
                <div className="border border-[var(--color-border)] rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/20 mb-3 space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-text)]">Reference Links (Optional)</label>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answerLinkForm.title}
                      onChange={(e) => setAnswerLinkForm({ ...answerLinkForm, title: e.target.value })}
                      className="input text-xs py-1 px-2"
                      placeholder="Title"
                    />
                    <input
                      type="text"
                      value={answerLinkForm.url}
                      onChange={(e) => setAnswerLinkForm({ ...answerLinkForm, url: e.target.value })}
                      className="input text-xs py-1 px-2 flex-1"
                      placeholder="URL"
                    />
                    <button
                      type="button"
                      onClick={addAnswerLink}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Add
                    </button>
                  </div>

                  {answerLinks.length > 0 && (
                    <div className="space-y-1">
                      {answerLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-white dark:bg-gray-800 border border-[var(--color-border)] rounded-md text-[11px]">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline truncate max-w-[200px]">
                            {link.title || link.url}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeAnswerLink(idx)}
                            className="text-red-500 hover:text-red-750 font-bold px-1.5"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confidence Level Picker */}
                <div className="mb-4">
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">How confident are you?</p>
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
                            ? color === 'gray' ? 'bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-800 dark:text-gray-100' :
                              color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200' :
                              'bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              <p className="text-[var(--color-text-secondary)]">
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
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Escalate Question</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
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

      <DownvoteReasonModal
        isOpen={showDownvoteModal.open}
        onClose={() => setShowDownvoteModal({ open: false, targetType: null, targetId: null })}
        onSubmit={submitDownvoteWithReason}
        targetType={showDownvoteModal.targetType}
      />

      {showAddToFAQModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Add to FAQ</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Select an FAQ to add this question{showAddToFAQModal.answerId ? ' and answer' : ''} as a verified item.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Select FAQ</label>
              <select
                value={selectedFAQ}
                onChange={(e) => setSelectedFAQ(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                <option value="">Choose an FAQ...</option>
                {faqs.map(faq => (
                  <option key={faq._id} value={faq._id}>{faq.title}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddToFAQModal({ open: false, answerId: null })} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleAddToFAQ} disabled={addingToFAQ || !selectedFAQ} className="btn-primary">
                {addingToFAQ ? 'Adding...' : 'Add to FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
