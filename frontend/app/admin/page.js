'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
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
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      router.push('/');
      return;
    }
    fetchDashboard();
    fetchUsers();
    fetchFlagged();
    fetchDeepData();
    fetchAnomalies();
    if (user.role === 'admin') {
      fetchSiteReports();
    }
  }, [user]);
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
    finally { setLoading(false); }
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
  const tabs = ['dashboard', 'users', 'flagged', 'anomalies'];
  if (user?.role === 'admin') tabs.push('siteReports');
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
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {t}
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
                      {u.isBanned ? <span className="badge-red">Banned</span> : <span className="badge-green">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <button onClick={() => handleUnban(u._id)} className="btn-secondary btn-sm">Unban</button>
                      ) : (
                        <button onClick={() => handleBan(u._id)} className="btn-danger btn-sm">Ban</button>
                      )}
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
                        {report.status === 'pending' && (
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
      ) : null}
    </div>
  );
}