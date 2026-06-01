'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import QuestionCard from '@/components/QuestionCard';
import FAQCard from '@/components/FAQCard';
import { formatDate, getInitials } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function UserProfilePage() {
  const { username } = useParams();
  const { user: currentUser, updateProfile } = useAuth();
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [savedFaqs, setSavedFaqs] = useState([]);
  const [tab, setTab] = useState('questions');
  const [savedSubTab, setSavedSubTab] = useState('questions');
  const [loading, setLoading] = useState(true);

  // Edit profile states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhase, setEditPhase] = useState('pre');
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [updating, setUpdating] = useState(false);

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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('displayName', editDisplayName.trim());
      formData.append('bio', editBio.trim());
      formData.append('currentPhase', editPhase);
      if (editAvatarFile) {
        formData.append('avatar', editAvatarFile);
      }
      const data = await updateProfile(formData);
      setUser(prev => ({ ...prev, ...data.user }));
      setShowEditModal(false);
      setEditAvatarFile(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${api.baseUrl.replace('/api', '')}${avatar}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[var(--color-border)] rounded-full" />
            <div className="flex-1">
              <div className="h-6 bg-[var(--color-border)] rounded w-1/4 mb-2" />
              <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-bold text-[var(--color-text)]">User not found</h2>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Profile Info Card */}
      <div className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-md border border-[var(--color-border)]/60 rounded-2xl p-6 mb-8 relative">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            {user.avatar || user.avatarUrl ? (
              <img
                src={getAvatarUrl(user.avatar || user.avatarUrl)}
                alt={user.displayName || user.username}
                className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-[var(--color-primary)]/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-purple-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
                {getInitials(user.displayName || user.username)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-[var(--color-text)] truncate">{user.displayName || user.username}</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">@{user.username}</p>
              {user.bio && <p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed">{user.bio}</p>}
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-[var(--color-text-muted)] font-medium">
                <span className="flex items-center gap-1">
                  <span className="font-bold text-[var(--color-primary)] text-sm">{user.reputation}</span> reputation
                </span>
                {user.currentPhase && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold uppercase tracking-wider text-[9px]">
                    🚀 {user.currentPhase.replace('_', ' ')}
                  </span>
                )}
                {user.location && <span>📍 {user.location}</span>}
                {user.website && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                    🔗 {user.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span>📅 Joined {formatDate(user.createdAt)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mt-4 pt-3 border-t border-[var(--color-border)]/40">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-[var(--color-text)]">{user.questionCount || 0}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">Questions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-[var(--color-text)]">{user.answerCount || 0}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">Answers</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-[var(--color-text)]">{user.totalLikes || 0}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">Likes Received</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-[var(--color-text)]">{user.totalVotes || 0}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">Votes Received</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-extrabold text-[var(--color-text)]">{user.totalBookmarks || 0}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">Bookmarks</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 self-stretch sm:self-auto shrink-0">
            {user.role !== 'user' && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                user.role === 'admin' 
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {user.role}
              </span>
            )}
            {isOwnProfile && (
              <button
                onClick={() => {
                  setEditDisplayName(user.displayName || '');
                  setEditBio(user.bio || '');
                  setEditPhase(user.currentPhase || 'pre');
                  setShowEditModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-all flex items-center gap-1.5 bg-[var(--color-bg-secondary)]/80 sm:mt-auto"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {user.badges?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-[var(--color-border)]/40">
            {user.badges.map(badge => (
              <span key={badge} className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                🏆 {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]/50 pb-px">
        <button
          onClick={() => setTab('questions')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            tab === 'questions' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Questions ({user.questionCount || 0})
        </button>
        <button
          onClick={() => setTab('answers')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            tab === 'answers' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Answers ({user.answerCount || 0})
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setTab('saved')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              tab === 'saved' 
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Saved
          </button>
        )}
      </div>

      {/* Tab Content */}
      {tab === 'questions' ? (
        questions.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/40 rounded-2xl p-12 text-center text-[var(--color-text-secondary)]">
            No questions yet
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map(q => <QuestionCard key={q._id} question={q} />)}
          </div>
        )
      ) : tab === 'answers' ? (
        answers.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/40 rounded-2xl p-12 text-center text-[var(--color-text-secondary)]">
            No answers yet
          </div>
        ) : (
          <div className="space-y-4">
            {answers.map(answer => (
              <Link key={answer._id} href={`/questions/${answer.question?._id || answer.question}`} className="bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border)]/60 rounded-2xl p-5 block transition-all duration-300 hover:shadow-lg hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-2">
                  {answer.isAccepted && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      ✓ Accepted
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">{answer.upvotes || 0} votes</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">{answer.body?.slice(0, 300)}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-3">Answered {formatDate(answer.createdAt)}</p>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div>
          {isOwnProfile && (
            <div className="flex gap-2 mb-6 bg-[var(--color-bg-secondary)]/55 p-1 rounded-xl border border-[var(--color-border)]/40 w-fit">
              <button
                onClick={() => setSavedSubTab('questions')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  savedSubTab === 'questions' 
                    ? 'bg-[var(--color-primary)] text-white' 
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                Questions
              </button>
              <button
                onClick={() => setSavedSubTab('faqs')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  savedSubTab === 'faqs' 
                    ? 'bg-[var(--color-primary)] text-white' 
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                FAQs
              </button>
            </div>
          )}
          {savedSubTab === 'questions' ? (
            savedQuestions.length === 0 ? (
              <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/40 rounded-2xl p-12 text-center text-[var(--color-text-secondary)]">No saved questions yet</div>
            ) : (
              <div className="space-y-4">
                {savedQuestions.map(item => (
                  <QuestionCard key={item._id} question={item.question} />
                ))}
              </div>
            )
          ) : (
            savedFaqs.length === 0 ? (
              <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/40 rounded-2xl p-12 text-center text-[var(--color-text-secondary)]">No saved FAQs yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedFaqs.map(item => (
                  <FAQCard key={item._id} faq={item.faq} />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-[var(--color-bg-secondary)] rounded-2xl shadow-xl w-full max-w-md p-6 border border-[var(--color-border)]/50">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Edit Profile</h3>
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] h-28 resize-none"
                  maxLength={500}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Current Project Phase</label>
                <select
                  value={editPhase}
                  onChange={(e) => setEditPhase(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                >
                  <option value="pre">Pre-Internship / Getting Started</option>
                  <option value="phase1_coursework">Phase 1 - Coursework & LMS</option>
                  <option value="phase1_completed">Phase 1 Completed - Team Formation</option>
                  <option value="phase2_project">Phase 2 - Project & Interviews</option>
                  <option value="completed">Completed / Alumni</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Profile Picture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditAvatarFile(e.target.files[0] || null)}
                  className="w-full text-xs text-[var(--color-text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary-subtle)] file:text-[var(--color-primary)] hover:file:opacity-90 file:cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
