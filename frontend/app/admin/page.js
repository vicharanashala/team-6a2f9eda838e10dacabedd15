'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSocket } from '@/context/SocketContext';
export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [deepStats, setDeepStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [flaggedQs, setFlaggedQs] = useState([]);
  const [flaggedAs, setFlaggedAs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const [siteReports, setSiteReports] = useState([]);
  const [anomalySeverityFilter, setAnomalySeverityFilter] = useState('all');
  const [anomalyStatusFilter, setAnomalyStatusFilter] = useState('unresolved');
  const [anomalySortBy, setAnomalySortBy] = useState('time');
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [anomalyPagination, setAnomalyPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const [moderationQueue, setModerationQueue] = useState({ questions: [], answers: [] });
  const [reportedPosts, setReportedPosts] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Email System States
  const [emails, setEmails] = useState([]);
  const [emailStats, setEmailStats] = useState({ pendingCount: 0, sentToday: 0, bouncedCount: 0 });
  const [emailPage, setEmailPage] = useState(1);
  const [emailPagination, setEmailPagination] = useState({ page: 1, pages: 1 });
  const [bounces, setBounces] = useState([]);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      router.push('/');
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      try {
        if (tab === 'dashboard') {
          await Promise.all([fetchDashboard(), fetchDeepData()]);
        } else if (tab === 'users') {
          await fetchUsers();
        } else if (tab === 'flagged') {
          await fetchFlagged();
        } else if (tab === 'anomalies') {
          await fetchAnomalies();
        } else if (tab === 'moderationQueue') {
          await fetchModerationQueue();
        } else if (tab === 'reportedPosts') {
          await fetchReportedPosts();
        } else if (tab === 'suspiciousActivities') {
          await fetchSuspiciousActivities();
        } else if (tab === 'auditLogs') {
          await fetchAuditLogs();
        } else if (tab === 'siteReports' && user.role === 'admin') {
          await fetchSiteReports();
        } else if (tab === 'emails' && user.role === 'admin') {
          await Promise.all([fetchEmails(), fetchBounces()]);
        }
      } catch (err) {
        console.error("Error loading admin data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, tab]);

  useEffect(() => {
    if (!socket) return;
    const handleModerationUpdate = () => {
      // Re-fetch only the active tab's data
      if (tab === 'dashboard') {
        fetchDashboard();
        fetchDeepData();
      } else if (tab === 'users') {
        fetchUsers();
      } else if (tab === 'flagged') {
        fetchFlagged();
      } else if (tab === 'anomalies') {
        fetchAnomalies();
      } else if (tab === 'moderationQueue') {
        fetchModerationQueue();
      } else if (tab === 'reportedPosts') {
        fetchReportedPosts();
      } else if (tab === 'suspiciousActivities') {
        fetchSuspiciousActivities();
      } else if (tab === 'auditLogs') {
        fetchAuditLogs();
      } else if (tab === 'emails' && user?.role === 'admin') {
        fetchEmails();
        fetchBounces();
      }
    };
    socket.on('moderation:updated', handleModerationUpdate);
    return () => {
      socket.off('moderation:updated', handleModerationUpdate);
    };
  }, [socket, user, tab]);

  useEffect(() => {
    if (tab === 'emails' && user?.role === 'admin') {
      fetchEmails();
    }
  }, [emailPage]);

  const fetchEmails = async () => {
    try {
      const data = await api.get('/admin/emails/queue', { page: emailPage, limit: 15 });
      setEmails(data.emails || []);
      setEmailStats(data.stats || { pendingCount: 0, sentToday: 0, bouncedCount: 0 });
      setEmailPagination(data.pagination || { page: 1, pages: 1 });
    } catch (err) {
      console.error('Failed to fetch email queue:', err);
    }
  };

  const fetchBounces = async () => {
    try {
      const data = await api.get('/admin/emails/bounces');
      setBounces(data.bounces || []);
    } catch (err) {
      console.error('Failed to fetch bounces:', err);
    }
  };

  const handleForceProcessQueue = async () => {
    try {
      await api.post('/admin/emails/process');
      toast.success('Queue processing triggered in background');
      setTimeout(fetchEmails, 1000);
    } catch (err) {
      toast.error(err.message || 'Failed to trigger queue processing');
    }
  };

  const handleRetryFailed = async () => {
    try {
      const res = await api.post('/admin/emails/retry-failed');
      toast.success(res.message || 'Failed/bounced emails reset to pending');
      fetchEmails();
    } catch (err) {
      toast.error(err.message || 'Failed to reset emails');
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to permanently delete all emails in the queue?')) return;
    try {
      await api.delete('/admin/emails/queue');
      toast.success('Email queue cleared');
      fetchEmails();
    } catch (err) {
      toast.error(err.message || 'Failed to clear queue');
    }
  };

  const handleRemoveBounce = async (id) => {
    try {
      await api.delete(`/admin/emails/bounces/${id}`);
      toast.success('Bounce record removed');
      fetchBounces();
      fetchEmails();
    } catch (err) {
      toast.error(err.message || 'Failed to remove bounce record');
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'moderator')) {
      fetchAnomalies();
    }
  }, [anomalySeverityFilter, anomalyStatusFilter, anomalySortBy, anomalyPage]);

  const fetchDashboard = async () => {
    try {
      const data = await api.get('/admin/dashboard');
      setStats(data.stats);
    } catch (_) {}
  };
  const fetchDeepData = async () => {
    try {
      const [userRes, faqRes] = await Promise.all([
        api.get('/admin/user-analytics'),
        api.get('/admin/faq-analytics')
      ]);
      setDeepStats({
        userStats: userRes.data || [],
        faqStats: faqRes.data || []
      });
    } catch (error) { console.error("Error fetching deep stats:", error); }
  };
  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      setUsers(data.users || []);
    } catch (_) {}
  };
  const fetchFlagged = async () => {
    try {
      const data = await api.get('/admin/flagged');
      setFlaggedQs(data.flaggedQuestions || []);
      setFlaggedAs(data.flaggedAnswers || []);
    } catch (_) {}
  };
  const fetchAnomalies = async () => {
    try {
      const data = await api.get('/admin/anomalies', {
        params: {
          severity: anomalySeverityFilter,
          status: anomalyStatusFilter,
          sortBy: anomalySortBy,
          page: anomalyPage,
          limit: 10
        }
      });
      setAnomalies(data.anomalies || []);
      setAnomalyStats(data.stats);
      setAnomalyPagination(data.pagination || { page: 1, pages: 1 });
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    }
  };
  const handleResolveAnomaly = async (id) => {
    try {
      await api.post(`/admin/anomalies/${id}/resolve`);
      toast.success('Anomaly marked as resolved');
      fetchAnomalies();
    } catch (err) {
      toast.error(err.message || 'Failed to resolve anomaly');
    }
  };
  const fetchSiteReports = async () => {
    try {
      const data = await api.get('/admin/reports');
      setSiteReports(data.reports || []);
    } catch (_) {}
  };
  const handleResolveSiteReport = async (reportId) => {
    try {
      await api.post(`/admin/reports/${reportId}/resolve`);
      toast.success('Site issue marked as resolved');
      fetchSiteReports();
    } catch (err) {
      toast.error(err.message || 'Failed to resolve site report');
    }
  };
  const handleBan = async (userId) => {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason });
      toast.success('User banned');
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };
  const handleUnban = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/unban`);
      toast.success('User unbanned');
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };
  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you absolutely sure you want to permanently delete user @${username}? This action is irreversible and will delete all of their questions, answers, and platform statistics.`)) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  };
  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast.success('Role updated');
      fetchUsers();
    } catch (err) { toast.error(err.message); }
  };
  const clearCache = async () => {
    try {
      await api.post('/admin/cache/clear');
      toast.success('Cache cleared');
    } catch (err) { toast.error(err.message); }
  };

  const fetchModerationQueue = async () => {
    try {
      const data = await api.get('/admin/moderation/queue');
      setModerationQueue(data || { questions: [], answers: [] });
    } catch (_) {}
  };

  const fetchReportedPosts = async () => {
    try {
      const data = await api.get('/admin/moderation/reported');
      setReportedPosts(data.reports || []);
    } catch (_) {}
  };

  const fetchSuspiciousActivities = async () => {
    try {
      const data = await api.get('/admin/moderation/suspicious');
      setSuspiciousActivities(data.activities || []);
    } catch (_) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await api.get('/admin/moderation/audit-logs');
      setAuditLogs(data.logs || []);
    } catch (_) {}
  };

  const handleApprovePost = async (postId, postType) => {
    try {
      await api.post('/admin/moderation/approve', { postId, postType });
      toast.success('Post approved and published successfully');
      fetchModerationQueue();
    } catch (err) {
      toast.error(err.message || 'Failed to approve post');
    }
  };

  const handleRejectPost = async (postId, postType) => {
    const reason = prompt('Please specify a rejection reason:');
    if (reason === null) return;
    try {
      await api.post('/admin/moderation/reject', { postId, postType, reason });
      toast.success('Post rejected and hidden');
      fetchModerationQueue();
    } catch (err) {
      toast.error(err.message || 'Failed to reject post');
    }
  };

  const handleUserAction = async (userId, action) => {
    let reason = '';
    if (action !== 'activate') {
      reason = prompt(`Reason for user action "${action}":`);
      if (reason === null) return;
    } else {
      if (!confirm('Are you sure you want to lift all restrictions (unban/unblock/unsuspend/un-shadowban) for this user?')) return;
      reason = 'Lifting restrictions';
    }
    let durationHours = 0;
    if (action === 'suspend') {
      const hoursStr = prompt('Suspension duration in hours (default 24):', '24');
      if (!hoursStr) return;
      durationHours = parseInt(hoursStr) || 24;
    }
    try {
      await api.post('/admin/moderation/action', { userId, action, durationHours, reason });
      toast.success(action === 'activate' ? 'Successfully lifted all restrictions' : `Successfully applied action "${action}" to user`);
      fetchReportedPosts();
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to moderate user');
    }
  };

  const tabs = ['dashboard', 'users', 'flagged', 'anomalies'];
  if (user?.role === 'admin' || user?.role === 'moderator') {
    tabs.push('moderationQueue', 'reportedPosts', 'suspiciousActivities', 'auditLogs');
  }
  if (user?.role === 'admin') {
    tabs.push('siteReports', 'emails');
  }
  if (user?.role !== 'admin') {
    const uIdx = tabs.indexOf('users');
    if (uIdx > -1) tabs.splice(uIdx, 1);
  }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Admin Panel</h1>
        {user?.role === 'admin' && (
          <button onClick={clearCache} className="btn-secondary btn-sm">Clear Cache</button>
        )}
      </div>
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {t === 'moderationQueue' ? 'Moderation Queue' :
             t === 'reportedPosts' ? 'Reported Content' :
             t === 'suspiciousActivities' ? 'Suspicious Activity' :
             t === 'auditLogs' ? 'Audit Logs' :
             t === 'siteReports' ? 'Site Reports' :
             t === 'emails' ? 'Email Queue' :
             t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="card p-8 animate-pulse space-y-4">
          <div className="h-8 bg-[var(--color-border)] rounded w-1/4" />
          <div className="h-4 bg-[var(--color-border)] rounded w-1/2" />
        </div>
      ) : tab === 'dashboard' && stats ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Questions', value: stats.totalQuestions },
              { label: 'Total Answers', value: stats.totalAnswers },
              { label: 'Total Users', value: stats.totalUsers },
              { label: 'Total FAQs', value: stats.totalFAQs },
              { label: 'Total Votes', value: stats.totalVotes },
              { label: 'Questions Today', value: stats.questionsToday },
              { label: 'Resolution Rate', value: `${stats.resolutionRate}%` },
            ].map(item => (
              <div key={item.label} className="card p-4 text-center">
                <p className="text-2xl font-bold text-primary-600">{item.value}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {deepStats && (
            <div className="mt-8 border-t border-[var(--color-border)] pt-8">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-6">Platform Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4 text-[var(--color-text)]">New Registrations (30 Days)</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {deepStats.userStats?.map((day) => (
                      <div key={day._id} className="flex justify-between items-center border-b border-[var(--color-border)] pb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">{day._id}</span>
                        <span className="text-sm font-medium text-[var(--color-text)]">{day.newUsers} users</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-lg mb-4 text-[var(--color-text)]">Top 10 Most Helpful FAQs</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {deepStats.faqStats?.map((faq, index) => (
                      <div key={index} className="flex flex-col border-b border-[var(--color-border)] pb-2">
                        <span className="font-medium text-sm text-[var(--color-text)]">{faq.question}</span>
                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                          <span className="text-green-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2" /></svg>
                            {faq.helpfulCount}
                          </span>
                          <span className="text-red-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                            {faq.notHelpfulCount}
                          </span>
                          <span className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">{faq.category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'users' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">User</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{u.displayName || u.username}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">@{u.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-[var(--color-bg)] text-[var(--color-text)]"
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned || u.status === 'blocked' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Banned / Blocked
                        </span>
                      ) : u.status === 'shadow_banned' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          Shadow Banned
                        </span>
                      ) : u.status === 'suspended' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          Suspended
                        </span>
                      ) : u.status === 'warned' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Warned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      {u.isBanned || u.status === 'blocked' || u.status === 'shadow_banned' || u.status === 'suspended' || u.status === 'warned' ? (
                        <button
                          onClick={() => handleUserAction(u._id, 'activate')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
                        >
                          Activate / Unblock
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => handleBan(u._id)} className="btn-danger btn-sm">Ban</button>
                          <button onClick={() => handleUserAction(u._id, 'suspend')} className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-[10px] font-bold">Suspend</button>
                          <button onClick={() => handleUserAction(u._id, 'shadow_ban')} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold">Shadow Ban</button>
                        </div>
                      )}
                      <button onClick={() => handleDeleteUser(u._id, u.username)} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'flagged' ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">Flagged Questions ({flaggedQs.length})</h3>
            {flaggedQs.length === 0 ? (
              <div className="card p-4 text-sm text-[var(--color-text-secondary)]">No flagged questions</div>
            ) : (
              <div className="space-y-2">
                {flaggedQs.map(q => (
                  <div key={q._id} className="card p-4">
                    <p className="font-medium text-[var(--color-text)]">{q.title}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Reason: {q.flagReason}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">Flagged by: {q.flaggedBy?.username}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">Flagged Answers ({flaggedAs.length})</h3>
            {flaggedAs.length === 0 ? (
              <div className="card p-4 text-sm text-[var(--color-text-secondary)]">No flagged answers</div>
            ) : (
              <div className="space-y-2">
                {flaggedAs.map(a => (
                  <div key={a._id} className="card p-4">
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{a.body}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">Reason: {a.flagReason}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">Flagged by: {a.flaggedBy?.username}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'anomalies' ? (
        <div className="space-y-6">
          {/* Live Alerts Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 border-l-4 border-red-500 bg-red-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Open HIGH Alerts</p>
              <p className="text-3xl font-extrabold text-red-600 dark:text-red-400 mt-1">{anomalyStats?.openHighCount || 0}</p>
            </div>
            <div className="card p-4 border-l-4 border-amber-500 bg-amber-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Open MEDIUM Alerts</p>
              <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{anomalyStats?.openMediumCount || 0}</p>
            </div>
            <div className="card p-4 border-l-4 border-blue-500 bg-blue-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Total Active Anomalies</p>
              <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {(anomalyStats?.openHighCount || 0) + (anomalyStats?.openMediumCount || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Resolution Time */}
            <div className="card p-6">
              <h4 className="font-semibold text-lg mb-4 text-[var(--color-text)]">Average Resolution Time</h4>
              <div className="grid grid-cols-3 gap-4 text-center mt-6">
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-bold">HIGH Severity</p>
                  <p className="text-3xl font-extrabold text-red-600 dark:text-red-400 mt-2">
                    {anomalyStats?.avgResolutionTimes?.high !== undefined ? `${anomalyStats.avgResolutionTimes.high}m` : '0m'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-bold">MEDIUM Severity</p>
                  <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                    {anomalyStats?.avgResolutionTimes?.medium !== undefined ? `${anomalyStats.avgResolutionTimes.medium}m` : '0m'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-bold">LOW Severity</p>
                  <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                    {anomalyStats?.avgResolutionTimes?.low !== undefined ? `${anomalyStats.avgResolutionTimes.low}m` : '0m'}
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly Trend Chart */}
            <div className="card p-6">
              <h4 className="font-semibold text-lg mb-2 text-[var(--color-text)]">Weekly Anomaly Trend (Last 4 Weeks)</h4>
              <div className="flex items-end justify-between h-36 pt-4 px-2 border-b border-l border-[var(--color-border)]">
                {anomalyStats?.trend && anomalyStats.trend.length > 0 ? (
                  anomalyStats.trend.map((t, idx) => {
                    const maxVal = Math.max(...anomalyStats.trend.map(item => item.count), 1);
                    const percent = (t.count / maxVal) * 80 + 10;
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 group">
                        <div className="text-xs font-semibold text-[var(--color-text)] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {t.count}
                        </div>
                        <div 
                          style={{ height: `${percent}%` }}
                          className="w-8 sm:w-10 bg-gradient-to-t from-[var(--color-primary)] to-purple-500 rounded-t-lg shadow-md hover:from-purple-500 hover:to-[var(--color-primary)] transition-all duration-300"
                        />
                        <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 font-medium">
                          Week {t.week.split('-')[1] || t.week}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full flex items-center justify-center text-sm text-[var(--color-text-muted)] h-full">
                    No trend data available for the last 30 days
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filters & Table */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Anomalies Moderation Queue</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={anomalySeverityFilter}
                  onChange={(e) => { setAnomalySeverityFilter(e.target.value); setAnomalyPage(1); }}
                  className="border border-[var(--color-border)] rounded-xl px-3 py-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-text)] text-xs"
                >
                  <option value="all">All Severities</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="low">Low Only</option>
                </select>

                <select
                  value={anomalyStatusFilter}
                  onChange={(e) => { setAnomalyStatusFilter(e.target.value); setAnomalyPage(1); }}
                  className="border border-[var(--color-border)] rounded-xl px-3 py-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-text)] text-xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="unresolved">Unresolved Only</option>
                  <option value="resolved">Resolved Only</option>
                </select>

                <select
                  value={anomalySortBy}
                  onChange={(e) => { setAnomalySortBy(e.target.value); setAnomalyPage(1); }}
                  className="border border-[var(--color-border)] rounded-xl px-3 py-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-text)] text-xs"
                >
                  <option value="time">Sort by Time (Newest)</option>
                  <option value="severity">Sort by Severity (Score)</option>
                </select>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Severity</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">User</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Query Preview</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Time Elapsed</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--color-text)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {anomalies.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-[var(--color-text-secondary)]">
                          No anomalies found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      anomalies.map(a => {
                        const timeElapsed = Math.round((new Date() - new Date(a.createdAt)) / (1000 * 60));
                        const displayTime = timeElapsed < 60 ? `${timeElapsed}m ago` : `${Math.round(timeElapsed / 60)}h ago`;
                        
                        return (
                          <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                a.anomalySeverity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                a.anomalySeverity === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {a.anomalySeverity} ({a.anomalyScore})
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-[var(--color-text)]">{a.author?.displayName || a.author?.username || 'Anonymous'}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{a.author?.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <a href={`/questions/${a._id}`} className="font-semibold text-primary-600 hover:underline block truncate">
                                {a.title}
                              </a>
                              <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{a.body}</p>
                            </td>
                            <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                              {displayTime}
                            </td>
                            <td className="px-4 py-3">
                              {a.anomalyResolvedAt ? (
                                <div className="text-xs">
                                  <span className="badge-green">Resolved</span>
                                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">by @{a.anomalyResolvedBy?.username}</p>
                                </div>
                              ) : (
                                <span className="badge-red">Unresolved</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!a.anomalyResolvedAt && (
                                <button
                                  onClick={() => handleResolveAnomaly(a._id)}
                                  className="btn-primary btn-sm px-3 py-1 text-xs"
                                >
                                  Mark Resolved
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {anomalyPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                  <button
                    onClick={() => setAnomalyPage(p => Math.max(1, p - 1))}
                    disabled={anomalyPage === 1}
                    className="btn-secondary btn-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Page {anomalyPage} of {anomalyPagination.pages}
                  </span>
                  <button
                    onClick={() => setAnomalyPage(p => Math.min(anomalyPagination.pages, p + 1))}
                    disabled={anomalyPage === anomalyPagination.pages}
                    className="btn-secondary btn-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'siteReports' ? (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border)] bg-gradient-to-r from-red-500/5 to-amber-500/5">
            <h3 className="font-bold text-lg text-[var(--color-text)] flex items-center gap-2">
              <span>🚨</span>
              <span>Site Issue Reports / Flags ({siteReports.length})</span>
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              User-submitted reports regarding technical issues or bugs on the platform.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Subject</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Description</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Page URL</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Submitted By</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Date</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {siteReports.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-[var(--color-text-secondary)]">
                      No site reports submitted yet.
                    </td>
                  </tr>
                ) : (
                  siteReports.map(report => (
                    <tr key={report._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        {report.status === 'resolved' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{report.subject}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-xs truncate" title={report.description}>
                        {report.description}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono max-w-xs truncate" title={report.pageUrl}>
                        {report.pageUrl ? (
                          <a href={report.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                            {report.pageUrl}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {report.user ? (
                          <div>
                            <p className="font-medium text-[var(--color-text)]">{report.user.displayName || report.user.username}</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">@{report.user.username}</p>
                          </div>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolveSiteReport(report._id)}
                            className="btn-primary btn-sm px-3 py-1.5 rounded-lg text-xs"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'moderationQueue' ? (
        <div className="space-y-6">
          <div className="card p-5 bg-gradient-to-r from-green-500/5 to-blue-500/5">
            <h3 className="font-bold text-lg text-[var(--color-text)]">Pre-Moderation Queue</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Approve or reject posts submitted by new users before they go public.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-[var(--color-text)] text-sm">Pending Questions ({moderationQueue.questions?.length || 0})</h4>
            {(!moderationQueue.questions || moderationQueue.questions.length === 0) ? (
              <div className="card p-4 text-xs text-[var(--color-text-secondary)]">No pending questions.</div>
            ) : (
              <div className="grid gap-4">
                {moderationQueue.questions.map(q => (
                  <div key={q._id} className="card p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                          Question
                        </span>
                        <h4 className="font-bold text-base text-[var(--color-text)] mt-1.5">{q.title}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePost(q._id, 'Question')}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectPost(q._id, 'Question')}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">{q.body}</div>
                    <div className="flex gap-4 text-[10px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
                      <span>By: <span className="font-medium">@{q.author?.username || 'unknown'}</span></span>
                      <span>Trust Score: <span className="font-medium text-primary-600">{q.author?.trustScore ?? 0}</span></span>
                      <span>Level: <span className="font-medium text-purple-600 uppercase">{q.author?.trustLevel || 'new'}</span></span>
                      <span>Date: <span className="font-medium">{formatDate(q.createdAt)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="font-semibold text-[var(--color-text)] text-sm">Pending Answers ({moderationQueue.answers?.length || 0})</h4>
            {(!moderationQueue.answers || moderationQueue.answers.length === 0) ? (
              <div className="card p-4 text-xs text-[var(--color-text-secondary)]">No pending answers.</div>
            ) : (
              <div className="grid gap-4">
                {moderationQueue.answers.map(ans => (
                  <div key={ans._id} className="card p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                          Answer
                        </span>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 font-semibold">
                          On Question: "{ans.question?.title || 'Unknown Question'}"
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePost(ans._id, 'Answer')}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectPost(ans._id, 'Answer')}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">{ans.body}</div>
                    <div className="flex gap-4 text-[10px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
                      <span>By: <span className="font-medium">@{ans.author?.username || 'unknown'}</span></span>
                      <span>Trust Score: <span className="font-medium text-primary-600">{ans.author?.trustScore ?? 0}</span></span>
                      <span>Level: <span className="font-medium text-purple-600 uppercase">{ans.author?.trustLevel || 'new'}</span></span>
                      <span>Date: <span className="font-medium">{formatDate(ans.createdAt)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'reportedPosts' ? (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border)] bg-gradient-to-r from-red-500/5 to-orange-500/5">
            <h3 className="font-bold text-lg text-[var(--color-text)]">Community Reports ({reportedPosts.length})</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Review posts flagged by the community. Apply restrictions or dismiss reports.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Post Type</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Post Preview</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Author</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Reason</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Flagged By</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Date</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)] text-right">Moderator Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {reportedPosts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-[var(--color-text-secondary)]">
                      No reported content in database.
                    </td>
                  </tr>
                ) : (
                  reportedPosts.map(rep => {
                    const postAuthor = rep.postId?.author;
                    return (
                      <tr key={rep._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rep.postType === 'Question' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                            {rep.postType}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate" title={rep.postId?.title || rep.postId?.body}>
                          {rep.postId ? (
                            rep.postType === 'Question' ? (
                              <a href={`/questions/${rep.postId._id}`} target="_blank" className="font-semibold hover:underline text-[var(--color-text)]">
                                {rep.postId.title}
                              </a>
                            ) : (
                              <span className="text-[var(--color-text-secondary)] italic">{rep.postId.body}</span>
                            )
                          ) : (
                            <span className="text-red-500 italic">Deleted / Missing Post</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {postAuthor ? (
                            <div>
                              <p className="font-medium text-[var(--color-text)]">@{postAuthor.username}</p>
                              <p className="text-[10px] text-[var(--color-text-secondary)]">Score: {postAuthor.trustScore ?? 0} ({postAuthor.trustLevel || 'new'})</p>
                            </div>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize font-semibold text-red-600 dark:text-red-400 text-xs bg-red-100/30 px-2 py-0.5 rounded">
                            {rep.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">@{rep.reportedBy?.username}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(rep.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {postAuthor && (
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => handleUserAction(postAuthor._id, 'warn')}
                                className="px-2 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded"
                              >
                                Warn
                              </button>
                              <button
                                onClick={() => handleUserAction(postAuthor._id, 'suspend')}
                                className="px-2 py-1 text-[10px] font-bold bg-orange-500 hover:bg-orange-600 text-white rounded"
                              >
                                Suspend
                              </button>
                              <button
                                onClick={() => handleUserAction(postAuthor._id, 'block')}
                                className="px-2 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded"
                              >
                                Block
                              </button>
                              <button
                                onClick={() => handleUserAction(postAuthor._id, 'shadow_ban')}
                                className="px-2 py-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded"
                              >
                                Shadow Ban
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'suspiciousActivities' ? (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border)] bg-gradient-to-r from-red-500/5 to-amber-500/5">
            <h3 className="font-bold text-lg text-[var(--color-text)]">Suspicious Activity Logs ({suspiciousActivities.length})</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Tracks sybil accounts, duplicate IPs, or matching browser fingerprints.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Type</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Shared Identifier</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Flagged Accounts</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Confidence</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {suspiciousActivities.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center p-8 text-[var(--color-text-secondary)]">
                      No suspicious activity flags detected.
                    </td>
                  </tr>
                ) : (
                  suspiciousActivities.map(act => (
                    <tr key={act._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 capitalize">
                          {act.activityType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text)]">{act.sharedValue}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {act.affectedUsers?.map(usr => (
                            <span key={usr._id} className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-1.5 py-0.5 rounded text-[var(--color-text-secondary)]">
                              @{usr.username}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text)]">{act.confidenceScore}%</td>
                      <td className="px-4 py-3">
                        {act.isResolved ? (
                          <span className="badge-green">Resolved</span>
                        ) : (
                          <span className="badge-red">Unresolved</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(act.flagDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'auditLogs' ? (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border)] bg-gray-50 dark:bg-gray-800/20">
            <h3 className="font-bold text-lg text-[var(--color-text)]">Moderation Audit Logs ({auditLogs.length})</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              History of all manual moderator and administrator actions for safety review.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Moderator</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Action</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Target Type</th>
                  <th className="px-4 py-3 font-semibold text-[var(--color-text)]">Reason / Note</th>
                  <th className="px-4 py-3 font-semibold text(--color-text)">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center p-8 text-[var(--color-text-secondary)]">
                      No administrative logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                        {log.adminId ? `@${log.adminId.username}` : 'System'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs capitalize text-[var(--color-text-secondary)]">{log.action.replace('_', ' ')}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.targetType}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{log.reason}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'emails' ? (
        <div className="space-y-6">
          <div className="card p-5 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-[var(--color-text)]">Email Notification System</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Monitor the outbound queue, view statistics, force processing, and manage permanent bounces.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleForceProcessQueue}
                className="btn-primary btn-sm px-4 py-2 font-semibold text-xs rounded-lg shadow-sm"
              >
                ⚡ Force Process Queue
              </button>
              <button
                onClick={handleRetryFailed}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                🔄 Retry Failed/Bounced
              </button>
              <button
                onClick={handleClearQueue}
                className="px-4 py-2 border border-red-500 hover:bg-red-500/10 text-red-500 font-semibold text-xs rounded-lg shadow-sm"
              >
                🗑️ Clear Queue
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 border-l-4 border-indigo-500 bg-indigo-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Pending Queue</p>
              <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {emailStats.pendingCount}
              </p>
            </div>
            <div className="card p-4 border-l-4 border-emerald-500 bg-emerald-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Sent Today (Limit 450)</p>
              <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {emailStats.sentToday} / 450
              </p>
            </div>
            <div className="card p-4 border-l-4 border-rose-500 bg-rose-500/5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Bounced Total</p>
              <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {emailStats.bouncedCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email Queue Section */}
            <div className="card lg:col-span-2 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-[var(--color-border)]">
                  <h4 className="font-bold text-[var(--color-text)] text-sm">Active Queue Logs</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-[var(--color-border)]">
                        <th className="px-4 py-2.5 font-semibold text-[var(--color-text)]">To</th>
                        <th className="px-4 py-2.5 font-semibold text-[var(--color-text)]">Subject</th>
                        <th className="px-4 py-2.5 font-semibold text-[var(--color-text)]">Status</th>
                        <th className="px-4 py-2.5 font-semibold text-[var(--color-text)] text-center">Attempts</th>
                        <th className="px-4 py-2.5 font-semibold text-[var(--color-text)]">Next Retry At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {emails.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center p-8 text-[var(--color-text-secondary)]">
                            No emails in queue.
                          </td>
                        </tr>
                      ) : (
                        emails.map(email => (
                          <tr key={email._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 text-xs">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[var(--color-text)]">{email.userName}</p>
                              <p className="text-[var(--color-text-secondary)]">{email.to}</p>
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate" title={email.subject}>
                              {email.subject}
                              {email.failReason && (
                                <p className="text-[10px] text-red-500 font-medium mt-0.5 truncate" title={email.failReason}>
                                  Err: {email.failReason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                email.status === 'sent' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                email.status === 'pending' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse' :
                                email.status === 'bounced' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                              }`}>
                                {email.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                              {email.attempts} / {email.maxAttempts}
                            </td>
                            <td className="px-4 py-3 text-[var(--color-text-secondary)] text-[10px]">
                              {email.status === 'pending' ? formatDate(email.nextRetryAt) : 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {emailPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                  <button
                    onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                    disabled={emailPage === 1}
                    className="btn-secondary btn-sm disabled:opacity-50 text-xs px-2.5 py-1"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Page {emailPage} of {emailPagination.pages}
                  </span>
                  <button
                    onClick={() => setEmailPage(p => Math.min(emailPagination.pages, p + 1))}
                    disabled={emailPage === emailPagination.pages}
                    className="btn-secondary btn-sm disabled:opacity-50 text-xs px-2.5 py-1"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Bounces Sidebar */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border)]">
                <h4 className="font-bold text-[var(--color-text)] text-sm">Permanent Bounces ({bounces.length})</h4>
              </div>
              <div className="divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
                {bounces.length === 0 ? (
                  <p className="p-4 text-xs text-center text-[var(--color-text-secondary)]">
                    No permanent bounces registered.
                  </p>
                ) : (
                  bounces.map(b => (
                    <div key={b._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 flex justify-between items-start gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--color-text)] truncate" title={b.email}>
                          {b.email}
                        </p>
                        <p className="text-[10px] text-red-500 truncate mt-0.5" title={b.reason}>
                          {b.reason || 'Bounced'}
                        </p>
                        <p className="text-[9px] text-[var(--color-text-secondary)] mt-1">
                          Registered: {formatDate(b.bouncedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveBounce(b._id)}
                        className="p-1 hover:bg-rose-500/10 text-rose-500 rounded transition-colors"
                        title="Remove from bounce list to retry"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}