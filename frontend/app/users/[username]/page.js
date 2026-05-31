'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import QuestionCard from '@/components/QuestionCard';
import FAQCard from '@/components/FAQCard';
import { formatDate, getInitials } from '@/lib/utils';
import api from '@/lib/api';

export default function UserProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [savedFaqs, setSavedFaqs] = useState([]);
  const [tab, setTab] = useState('questions');
  const [savedSubTab, setSavedSubTab] = useState('questions');
  const [loading, setLoading] = useState(true);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    api.get(`/users/${username}`)
      .then(data => setUser(data.user))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (tab === 'questions') {
      api.get(`/users/${username}/questions`).then(d => setQuestions(d.questions || [])).catch(() => {});
    } else if (tab === 'answers') {
      api.get(`/users/${username}/answers`).then(d => setAnswers(d.answers || [])).catch(() => {});
    } else if (tab === 'saved' && isOwnProfile) {
      api.get('/users/me/saved').then(d => setSavedQuestions(d.saved || [])).catch(() => {});
      api.get('/users/me/saved/faqs').then(d => setSavedFaqs(d.saved || [])).catch(() => {});
    }
  }, [username, tab, isOwnProfile]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <h2 className="text-xl font-semibold">User not found</h2>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
            {getInitials(user.displayName || user.username)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--color-text)]">{user.displayName || user.username}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">@{user.username}</p>
            {user.bio && <p className="text-sm text-[var(--color-text-secondary)] mt-2">{user.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text)]">{user.reputation}</span> reputation
              {user.location && <span>{user.location}</span>}
              {user.website && (
                <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                  {user.website}
                </a>
              )}
              <span>Joined {formatDate(user.createdAt)}</span>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-text)]">{user.questionCount || 0}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Questions</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-text)]">{user.answerCount || 0}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Answers</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            {user.role !== 'user' && (
              <span className={`badge ${user.role === 'admin' ? 'badge-red' : 'badge-yellow'} capitalize`}>
                {user.role}
              </span>
            )}
          </div>
        </div>
        {user.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4 pt-3 border-t border-[var(--color-border)]">
            {user.badges.map(badge => (
              <span key={badge} className="badge-yellow text-xs">{badge}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        <button
          onClick={() => setTab('questions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'questions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Questions ({user.questionCount || 0})
        </button>
        <button
          onClick={() => setTab('answers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'answers' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Answers ({user.answerCount || 0})
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setTab('saved')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'saved' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            Saved
          </button>
        )}
      </div>

      {tab === 'questions' ? (
        questions.length === 0 ? (
          <div className="card p-8 text-center text-[var(--color-text-secondary)]">No questions yet</div>
        ) : (
          <div className="space-y-4">
            {questions.map(q => <QuestionCard key={q._id} question={q} />)}
          </div>
        )
      ) : tab === 'answers' ? (
        answers.length === 0 ? (
          <div className="card p-8 text-center text-[var(--color-text-secondary)]">No answers yet</div>
        ) : (
          <div className="space-y-4">
            {answers.map(answer => (
              <Link key={answer._id} href={`/questions/${answer.question?._id || answer.question}`} className="card-hover p-4 block">
                <div className="flex items-center gap-2 mb-2">
                  {answer.isAccepted && <span className="badge-green text-xs">Accepted</span>}
                  <span className="text-xs text-[var(--color-text-secondary)]">{answer.upvotes || 0} votes</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{answer.body?.slice(0, 300)}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Answered {formatDate(answer.createdAt)}</p>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div>
          {isOwnProfile && (
            <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
              <button
                onClick={() => setSavedSubTab('questions')}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  savedSubTab === 'questions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                Questions
              </button>
              <button
                onClick={() => setSavedSubTab('faqs')}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  savedSubTab === 'faqs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                FAQs
              </button>
            </div>
          )}
          {savedSubTab === 'questions' ? (
            savedQuestions.length === 0 ? (
              <div className="card p-8 text-center text-[var(--color-text-secondary)]">No saved questions yet</div>
            ) : (
              <div className="space-y-4">
                {savedQuestions.map(item => (
                  <QuestionCard key={item._id} question={item.question} />
                ))}
              </div>
            )
          ) : (
            savedFaqs.length === 0 ? (
              <div className="card p-8 text-center text-[var(--color-text-secondary)]">No saved FAQs yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedFaqs.map(item => (
                  <FAQCard key={item._id} faq={item.faq} />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
