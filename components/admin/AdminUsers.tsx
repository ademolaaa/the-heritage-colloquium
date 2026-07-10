import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
  moderator: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  user: 'bg-white/5 text-gray-400 border border-white/10',
};

export const AdminUsers: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // userId being changed
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const token = localStorage.getItem('auth_token') || '';

  const toast = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/v1/admin/users?limit=50${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setUsers(data.items);
        setTotal(data.total);
      } else {
        toast('err', data.error || 'Failed to load users');
      }
    } catch {
      toast('err', 'Network error');
    } finally {
      setLoading(false);
    }
  }, [search, token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const changeRole = async (userId: string, newRole: string) => {
    setBusy(userId);
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast('err', data.error || 'Role change failed');
        return;
      }
      toast('ok', `${data.user.email} is now ${newRole}`);
      // Refresh list & if current user changed, update context
      await fetchUsers();
      if (userId === currentUser?.id) await refreshUser();
    } catch {
      toast('err', 'Network error');
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-white">User Management</h2>
          <p className="text-gray-400 text-sm mt-1">
            {total} registered member{total !== 1 ? 's' : ''}. Promote or demote roles here.
          </p>
        </div>

        {message && (
          <div
            className={`text-xs tracking-wider uppercase px-4 py-2 rounded ${
              message.type === 'ok'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or username…"
          className="w-full bg-black/50 border border-white/10 px-4 py-3 pl-10 text-white placeholder:text-white/30 focus:border-gold-500 focus:outline-none transition-colors rounded-lg text-sm"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
      </div>

      {/* Security note */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-4 py-3 text-amber-400/70 text-xs leading-relaxed">
        <strong>Security:</strong> Role changes take effect on the user's next login. You cannot
        remove your own admin access, and the last admin can never be demoted.
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 animate-pulse py-8 text-center">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="text-gray-500 py-8 text-center">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="text-[10px] uppercase tracking-[0.2em] text-gray-500 pb-3 pr-4 font-semibold">User</th>
                <th className="text-[10px] uppercase tracking-[0.2em] text-gray-500 pb-3 pr-4 font-semibold">Role</th>
                <th className="text-[10px] uppercase tracking-[0.2em] text-gray-500 pb-3 pr-4 font-semibold">Joined</th>
                <th className="text-[10px] uppercase tracking-[0.2em] text-gray-500 pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => {
                const isCurrentUser = u.id === currentUser?.id;
                const isBusy = busy === u.id;
                return (
                  <tr key={u.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 font-semibold text-xs flex-shrink-0">
                          {(u.username || u.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {u.username || <span className="text-gray-500 italic">no username</span>}
                            {isCurrentUser && (
                              <span className="ml-2 text-[10px] text-gold-500 uppercase tracking-wider">(you)</span>
                            )}
                          </div>
                          <div className="text-gray-500 text-xs">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded font-semibold ${ROLE_BADGE[u.role] || ROLE_BADGE.user}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                    <td className="py-4">
                      <div className="flex gap-2 flex-wrap">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => changeRole(u.id, 'admin')}
                            disabled={isBusy}
                            className="text-[10px] uppercase tracking-wider px-3 py-1 bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/20 rounded transition-colors disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Make Admin'}
                          </button>
                        )}
                        {u.role !== 'moderator' && (
                          <button
                            onClick={() => changeRole(u.id, 'moderator')}
                            disabled={isBusy}
                            className="text-[10px] uppercase tracking-wider px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded transition-colors disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Make Moderator'}
                          </button>
                        )}
                        {u.role !== 'user' && !isCurrentUser && (
                          <button
                            onClick={() => changeRole(u.id, 'user')}
                            disabled={isBusy}
                            className="text-[10px] uppercase tracking-wider px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded transition-colors disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Demote to User'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
