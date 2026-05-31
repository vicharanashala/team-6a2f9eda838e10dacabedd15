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
  const [users, setUsers] = useState([]);
  const [flaggedQs, setFlaggedQs] = useState([]);
  const [flaggedAs, setFlaggedAs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      router.push('/');
      return;
    }
    fetchDashboard();
    fetchUsers();
    fetchFlagged();
  }, [user]);

  const fetchDashboard = async () => {
    try {
      const data = await api.get('/admin/dashboard');
      setStats(data.stats);
    } catch (_) {}
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

  const tabs = ['dashboard', 'users', 'flagged'];
  if (user?.role !== 'admin') tabs.splice(tabs.indexOf('users'), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Admin Panel</h1>
        {user?.role === 'admin' && (
          <button onClick={clearCache} className="btn-secondary btn-sm">Clear Cache</button>
        )}
      </div>

      {/* Tab navigation */}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Questions', value: stats.totalQuestions },
            { label: 'Total Answers', value: stats.totalAnswers },
            { label: 'Total Users', value: stats.totalUsers },
            { label: 'Total FAQs', value: stats.totalFAQs },
            { label: 'Total Votes', value: stats.totalVotes },
            { label: 'Questions Today', value: stats.questionsToday },
            { label: 'Resolution Rate', value: `${stats.resolutionRate}%` },
            { label: 'Active FAQs', value: stats.totalFAQs },
          ].map(item => (
            <div key={item.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{item.value}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{item.label}</p>
            </div>
          ))}
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
                      {u.isBanned ? (
                        <span className="badge-red">Banned</span>
                      ) : (
                        <span className="badge-green">Active</span>
                      )}
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
      ) : null}
    </div>
  );
}
