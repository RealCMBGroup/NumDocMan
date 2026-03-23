import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Shield, Users } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const TABS = ['users', 'roles'];

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', is_superadmin: false, preferred_language: 'fr' });

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', code: '', permissions: [], color: '#6B7280', description: '' });
  const [permInput, setPermInput] = useState('');

  useEffect(() => {
    api.get('/organizations').then(res => {
      setOrgs(res.data);
      if (res.data.length > 0) setSelectedOrg(res.data[0].id);
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get('/admin/users', { params: selectedOrg ? { org_id: selectedOrg } : {} }),
        selectedOrg ? api.get(`/organizations/${selectedOrg}/roles`) : Promise.resolve({ data: [] }),
      ]);
      setUsers(u.data);
      setRoles(r.data);
    } catch { toast.error(t('errors.server_error')); }
    finally { setLoading(false); }
  }, [selectedOrg, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, userForm);
      } else {
        await api.post('/admin/users', userForm);
      }
      toast.success(t('success'));
      setShowUserModal(false);
      setEditUser(null);
      setUserForm({ email: '', name: '', password: '', is_superadmin: false, preferred_language: 'fr' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success(t('success'));
      loadData();
    } catch { toast.error(t('errors.server_error')); }
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    try {
      if (editRole) {
        await api.put(`/organizations/${selectedOrg}/roles/${editRole.id}`, roleForm);
      } else {
        await api.post(`/organizations/${selectedOrg}/roles`, roleForm);
      }
      toast.success(t('success'));
      setShowRoleModal(false);
      setEditRole(null);
      setRoleForm({ name: '', code: '', permissions: [], color: '#6B7280', description: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteRole = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/organizations/${selectedOrg}/roles/${id}`);
      toast.success(t('success'));
      loadData();
    } catch { toast.error(t('errors.server_error')); }
  };

  const addPerm = () => {
    if (!permInput.trim()) return;
    setRoleForm({ ...roleForm, permissions: [...roleForm.permissions, permInput.trim()] });
    setPermInput('');
  };

  if (!user?.is_superadmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Shield size={48} className="text-[#CED4DA] mx-auto mb-3" />
            <p className="font-chivo font-700 text-[#121212]">{t('errors.forbidden')}</p>
            <p className="text-sm text-[#868E96] font-ibm mt-1">Accès réservé aux super administrateurs</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-chivo font-700 text-2xl text-[#121212]">{t('admin.title')}</h1>
          {orgs.length > 0 && (
            <select data-testid="admin-org-selector" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)} className="ndm-input w-auto">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#E2E8F0]">
          {TABS.map(tab => (
            <button
              key={tab}
              data-testid={`admin-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-ibm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === tab ? 'border-[#2E60CC] text-[#2E60CC]' : 'border-transparent text-[#868E96] hover:text-[#495057]'
              }`}
            >
              {tab === 'users' ? t('admin.users') : t('admin.roles')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-chivo font-700 text-base text-[#121212]">{t('admin.users')} ({users.length})</h2>
                  <button data-testid="create-user-btn" onClick={() => { setEditUser(null); setUserForm({ email: '', name: '', password: '', is_superadmin: false, preferred_language: 'fr' }); setShowUserModal(true); }} className="ndm-btn-primary flex items-center gap-2 text-sm">
                    <Plus size={14} /> {t('admin.create_user')}
                  </button>
                </div>
                <div className="ndm-card overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="table-dense"><th className="text-left">{t('name')}</th><th className="text-left">{t('auth.email')}</th><th className="text-left hidden md:table-cell">{t('status')}</th><th className="text-left hidden md:table-cell">Admin</th><th className="text-right">{t('actions')}</th></tr></thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-sm text-[#868E96] font-ibm">{t('admin.no_users')}</td></tr>
                      ) : (
                        users.map(u => (
                          <tr key={u.id} data-testid={`user-row-${u.id}`} className="table-dense">
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#2E60CC]/10 flex items-center justify-center text-[#2E60CC] font-ibm font-medium text-xs">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-ibm font-medium text-[#121212]">{u.name}</span>
                              </div>
                            </td>
                            <td className="text-[#868E96] font-ibm">{u.email}</td>
                            <td className="hidden md:table-cell">
                              <span className={`badge-state text-xs ${u.is_active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#868E96]/10 text-[#868E96]'}`}>
                                {u.is_active ? t('active') : 'Inactif'}
                              </span>
                            </td>
                            <td className="hidden md:table-cell">
                              {u.is_superadmin && <span className="badge-state bg-[#E50000]/10 text-[#E50000] text-xs">Super Admin</span>}
                            </td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button data-testid={`edit-user-${u.id}`} onClick={() => { setEditUser(u); setUserForm({ email: u.email, name: u.name, password: '', is_superadmin: u.is_superadmin, preferred_language: u.preferred_language }); setShowUserModal(true); }} className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]"><Pencil size={13} /></button>
                                <button data-testid={`delete-user-${u.id}`} onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-chivo font-700 text-base text-[#121212]">{t('admin.roles')}</h2>
                  <button data-testid="create-role-btn" onClick={() => { setEditRole(null); setRoleForm({ name: '', code: '', permissions: [], color: '#6B7280', description: '' }); setShowRoleModal(true); }} disabled={!selectedOrg} className="ndm-btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                    <Plus size={14} /> {t('admin.create_role')}
                  </button>
                </div>
                {roles.length === 0 ? (
                  <p className="text-sm text-[#868E96] font-ibm py-8 text-center">{t('admin.no_roles')}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {roles.map(r => (
                      <div key={r.id} data-testid={`role-${r.id}`} className="ndm-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                            <span className="font-mono-ibm text-xs text-[#868E96]">{r.code}</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditRole(r); setRoleForm({ name: r.name, code: r.code, permissions: r.permissions || [], color: r.color, description: r.description || '' }); setShowRoleModal(true); }} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96]"><Pencil size={12} /></button>
                            <button onClick={() => handleDeleteRole(r.id)} className="p-1 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <p className="font-ibm font-medium text-sm text-[#121212]">{r.name}</p>
                        {r.description && <p className="text-xs text-[#868E96] font-ibm mt-1">{r.description}</p>}
                        {r.permissions?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.permissions.slice(0, 3).map((p, i) => (
                              <span key={i} className="text-[9px] bg-[#F1F3F5] text-[#495057] px-1.5 py-0.5 rounded font-mono-ibm">{p}</span>
                            ))}
                            {r.permissions.length > 3 && <span className="text-[9px] text-[#868E96] font-ibm">+{r.permissions.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <AdminModal title={editUser ? t('edit') : t('admin.create_user')} onClose={() => setShowUserModal(false)}>
          <form onSubmit={handleSaveUser} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('name')} *</label><input className="ndm-input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('auth.email')} *</label><input type="email" className="ndm-input" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('auth.password')} {editUser ? '(laisser vide pour ne pas changer)' : '*'}</label><input type="password" className="ndm-input" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required={!editUser} /></div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('settings.language')}</label>
              <select className="ndm-input" value={userForm.preferred_language} onChange={e => setUserForm({ ...userForm, preferred_language: e.target.value })}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-ibm cursor-pointer">
              <input type="checkbox" checked={userForm.is_superadmin} onChange={e => setUserForm({ ...userForm, is_superadmin: e.target.checked })} className="rounded" />
              {t('admin.superadmin')}
            </label>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowUserModal(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button><button type="submit" className="ndm-btn-primary">{t('save')}</button></div>
          </form>
        </AdminModal>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <AdminModal title={editRole ? t('edit') : t('admin.create_role')} onClose={() => setShowRoleModal(false)}>
          <form onSubmit={handleSaveRole} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('admin.role_name')} *</label><input className="ndm-input" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('admin.role_code')} *</label><input className="ndm-input font-mono-ibm uppercase" value={roleForm.code} onChange={e => setRoleForm({ ...roleForm, code: e.target.value.toUpperCase() })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('description')}</label><input className="ndm-input" value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('admin.color')}</label><input type="color" className="h-8 w-16 border border-[#E2E8F0] rounded cursor-pointer" value={roleForm.color} onChange={e => setRoleForm({ ...roleForm, color: e.target.value })} /></div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('admin.permissions')}</label>
              <div className="flex gap-2 mb-1.5">
                <input className="ndm-input flex-1 font-mono-ibm text-xs" value={permInput} onChange={e => setPermInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPerm())} placeholder="doc:read, doc:write..." />
                <button type="button" onClick={addPerm} className="ndm-btn-primary px-3 text-sm">{t('add')}</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {roleForm.permissions.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-[#F1F3F5] text-[#495057] px-2 py-0.5 rounded font-mono-ibm">
                    {p}
                    <button type="button" onClick={() => setRoleForm({ ...roleForm, permissions: roleForm.permissions.filter((_, j) => j !== i) })} className="hover:text-[#E50000]">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowRoleModal(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button><button type="submit" className="ndm-btn-primary">{t('save')}</button></div>
          </form>
        </AdminModal>
      )}
    </Layout>
  );
}

function AdminModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-chivo font-700 text-base text-[#121212]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96] text-lg">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
