import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HardDrive, Cloud, Plus, Pencil, Trash2, Globe } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/api';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [storageConfigs, setStorageConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editConfig, setEditConfig] = useState(null);
  const [form, setForm] = useState({
    name: '',
    storage_type: 'local',
    local_path: './uploads',
    remote_url: '',
  });

  useEffect(() => {
    api.get('/organizations').then(res => {
      setOrgs(res.data);
      if (res.data.length > 0) setSelectedOrg(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    setLoading(true);
    api.get('/storage', { params: { org_id: selectedOrg } })
      .then(res => setStorageConfigs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedOrg]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, org_id: selectedOrg };
      if (editConfig) {
        await api.put(`/storage/${editConfig.id}`, payload);
      } else {
        await api.post('/storage', payload);
      }
      toast.success(t('success'));
      setShowModal(false);
      setEditConfig(null);
      const res = await api.get('/storage', { params: { org_id: selectedOrg } });
      setStorageConfigs(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.unknown'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/storage/${id}`);
      setStorageConfigs(storageConfigs.filter(s => s.id !== id));
      toast.success(t('success'));
    } catch { toast.error(t('errors.server_error')); }
  };

  const handleSetActive = async (id) => {
    try {
      await api.put(`/storage/${id}`, { is_active: true });
      const res = await api.get('/storage', { params: { org_id: selectedOrg } });
      setStorageConfigs(res.data);
    } catch { toast.error(t('errors.server_error')); }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in max-w-3xl">
        <h1 className="font-chivo font-700 text-2xl text-[#121212]">{t('settings.title')}</h1>

        {/* Language */}
        <div className="ndm-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-[#2E60CC]" />
            <h2 className="font-chivo font-700 text-base text-[#121212]">{t('settings.language')}</h2>
          </div>
          <div className="flex gap-3">
            {['fr', 'en'].map(lang => (
              <button
                key={lang}
                data-testid={`settings-lang-${lang}`}
                onClick={() => i18n.changeLanguage(lang)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-ibm transition-colors duration-150 ${
                  i18n.language === lang
                    ? 'bg-[#2E60CC] text-white border-[#2E60CC]'
                    : 'bg-white text-[#495057] border-[#E2E8F0] hover:border-[#2E60CC]'
                }`}
              >
                {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>

        {/* Organization selector */}
        {orgs.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">Organisation</label>
            <select data-testid="settings-org-selector" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)} className="ndm-input w-auto">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {/* Storage */}
        <div className="ndm-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-[#2E60CC]" />
              <h2 className="font-chivo font-700 text-base text-[#121212]">{t('settings.storage')}</h2>
            </div>
            <button
              data-testid="add-storage-btn"
              onClick={() => { setEditConfig(null); setForm({ name: '', storage_type: 'local', local_path: './uploads', remote_url: '' }); setShowModal(true); }}
              disabled={!selectedOrg}
              className="ndm-btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Plus size={14} /> {t('settings.add_storage')}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" /></div>
          ) : storageConfigs.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive size={32} className="text-[#CED4DA] mx-auto mb-2" />
              <p className="text-sm text-[#868E96] font-ibm">Aucune configuration de stockage</p>
              <p className="text-xs text-[#868E96] font-ibm mt-1">Le stockage local par défaut est utilisé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {storageConfigs.map(sc => (
                <div key={sc.id} data-testid={`storage-${sc.id}`} className={`ndm-card p-4 ${sc.is_active ? 'border-[#2E60CC] bg-[#2E60CC]/5' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sc.storage_type === 'local' ? <HardDrive size={16} className="text-[#2E60CC]" /> : <Cloud size={16} className="text-[#6366F1]" />}
                      <div>
                        <p className="font-ibm font-medium text-sm text-[#121212]">{sc.name}</p>
                        <p className="text-xs text-[#868E96] font-ibm">
                          {sc.storage_type === 'local' ? sc.local_path : sc.remote_url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sc.is_active ? (
                        <span className="badge-state bg-[#10B981]/10 text-[#10B981] text-xs">{t('settings.active')}</span>
                      ) : (
                        <button onClick={() => handleSetActive(sc.id)} className="text-xs text-[#2E60CC] hover:underline font-ibm">Activer</button>
                      )}
                      <button onClick={() => { setEditConfig(sc); setForm({ name: sc.name, storage_type: sc.storage_type, local_path: sc.local_path, remote_url: sc.remote_url || '' }); setShowModal(true); }} className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(sc.id)} className="p-1.5 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-lg w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-chivo font-700 text-base text-[#121212]">{editConfig ? t('edit') : t('settings.add_storage')}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96] text-lg">×</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('name')} *</label>
                <input data-testid="storage-name" className="ndm-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('settings.storage_type')}</label>
                <div className="flex gap-2">
                  {['local', 'remote'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm({ ...form, storage_type: type })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md border text-sm font-ibm transition-colors duration-150 ${
                        form.storage_type === type ? 'bg-[#2E60CC] text-white border-[#2E60CC]' : 'bg-white text-[#495057] border-[#E2E8F0]'
                      }`}
                    >
                      {type === 'local' ? <HardDrive size={14} /> : <Cloud size={14} />}
                      {type === 'local' ? t('settings.local') : t('settings.remote')}
                    </button>
                  ))}
                </div>
              </div>
              {form.storage_type === 'local' ? (
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('settings.local_path')}</label>
                  <input data-testid="storage-local-path" className="ndm-input font-mono-ibm" value={form.local_path} onChange={e => setForm({ ...form, local_path: e.target.value })} placeholder="./uploads/OrgName/ProjectName" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('settings.remote_url')}</label>
                  <input data-testid="storage-remote-url" className="ndm-input" value={form.remote_url} onChange={e => setForm({ ...form, remote_url: e.target.value })} placeholder="https://storage.example.com/bucket" />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button>
                <button data-testid="storage-submit" type="submit" className="ndm-btn-primary">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
