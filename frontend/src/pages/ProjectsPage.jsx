import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Building2, FolderPlus, ChevronRight, Search, MoreVertical, Users, FileText, Settings, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/api';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showProjModal, setShowProjModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [orgForm, setOrgForm] = useState({ name: '', code: '', description: '' });
  const [projForm, setProjForm] = useState({ name: '', code: '', description: '', phases: [], org_id: '' });
  const [phaseInput, setPhaseInput] = useState('');

  const loadOrgs = useCallback(async () => {
    try {
      const res = await api.get('/organizations');
      setOrgs(res.data);
      if (res.data.length > 0 && !selectedOrg) setSelectedOrg(res.data[0].id);
    } catch { toast.error(t('errors.server_error')); }
  }, [selectedOrg, t]);

  const loadProjects = useCallback(async () => {
    if (!selectedOrg) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/projects', { params: { org_id: selectedOrg } });
      setProjects(res.data);
    } catch { toast.error(t('errors.server_error')); }
    finally { setLoading(false); }
  }, [selectedOrg, t]);

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { if (selectedOrg) loadProjects(); }, [selectedOrg]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      await api.post('/organizations', orgForm);
      toast.success(t('success'));
      setShowOrgModal(false);
      setOrgForm({ name: '', code: '', description: '' });
      loadOrgs();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...projForm, org_id: selectedOrg };
      if (editProject) {
        await api.put(`/projects/${editProject.id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      toast.success(t('success'));
      setShowProjModal(false);
      setProjForm({ name: '', code: '', description: '', phases: [] });
      setEditProject(null);
      loadProjects();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success(t('success'));
      loadProjects();
    } catch { toast.error(t('errors.server_error')); }
  };

  const addPhase = () => {
    if (!phaseInput.trim()) return;
    setProjForm({ ...projForm, phases: [...projForm.phases, phaseInput.trim().toUpperCase()] });
    setPhaseInput('');
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()));

  const statusColor = { active: '#10B981', archived: '#868E96', closed: '#E50000' };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-chivo font-700 text-2xl text-[#121212]">{t('project.title')}</h1>
          <div className="flex items-center gap-2">
            <button data-testid="create-org-btn" onClick={() => setShowOrgModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm border border-[#E2E8F0] rounded-md text-[#495057] hover:bg-[#F8F9FA] font-ibm" style={{ transition: 'background-color 150ms ease' }}>
              <Building2 size={15} />
              {t('org.create')}
            </button>
            <button data-testid="create-project-btn" onClick={() => { setEditProject(null); setProjForm({ name: '', code: '', description: '', phases: [] }); setShowProjModal(true); }} className="ndm-btn-primary flex items-center gap-2" disabled={!selectedOrg}>
              <Plus size={15} />
              {t('project.create')}
            </button>
          </div>
        </div>

        {/* Org selector */}
        {orgs.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-ibm text-[#868E96] uppercase tracking-wide">Organisation:</span>
            <div className="flex gap-2 flex-wrap">
              {orgs.map(o => (
                <button
                  key={o.id}
                  data-testid={`org-tab-${o.id}`}
                  onClick={() => setSelectedOrg(o.id)}
                  className={`px-3 py-1.5 text-sm rounded-md border font-ibm transition-colors duration-150 ${
                    selectedOrg === o.id
                      ? 'bg-[#2E60CC] text-white border-[#2E60CC]'
                      : 'bg-white text-[#495057] border-[#E2E8F0] hover:border-[#2E60CC]'
                  }`}
                >
                  {o.name} <span className="font-mono-ibm text-[10px] opacity-70">({o.code})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        {projects.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868E96]" />
            <input
              data-testid="project-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search') + '...'}
              className="ndm-input pl-9"
            />
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ndm-card p-10 text-center">
            <FolderPlus size={40} className="text-[#CED4DA] mx-auto mb-3" />
            <p className="font-chivo font-700 text-[#121212]">{t('project.no_projects')}</p>
            {selectedOrg && <p className="text-sm text-[#868E96] font-ibm mt-1">{t('project.create')} →</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <div key={p.id} data-testid={`project-card-${p.id}`} className="ndm-card p-5 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor[p.status] || '#868E96' }} />
                      <span className="font-mono-ibm text-[10px] text-[#868E96] uppercase">{p.code}</span>
                    </div>
                    <h3 className="font-chivo font-700 text-base text-[#121212] truncate">{p.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      data-testid={`edit-project-${p.id}`}
                      onClick={() => { setEditProject(p); setProjForm({ name: p.name, code: p.code, description: p.description || '', phases: p.phases || [] }); setShowProjModal(true); }}
                      className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]"
                      style={{ transition: 'background-color 150ms ease' }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      data-testid={`delete-project-${p.id}`}
                      onClick={() => handleDeleteProject(p.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]"
                      style={{ transition: 'background-color 150ms ease, color 150ms ease' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {p.description && <p className="text-xs text-[#868E96] font-ibm line-clamp-2 mb-3">{p.description}</p>}

                <div className="flex items-center gap-3 text-xs text-[#868E96] font-ibm mb-3">
                  <span className="flex items-center gap-1">
                    <FileText size={11} />
                    {p.doc_count || 0} {t('project.docs_count')}
                  </span>
                  {p.phases?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {p.phases.slice(0, 3).map(ph => (
                        <span key={ph} className="font-mono-ibm text-[9px] bg-[#F1F3F5] text-[#495057] px-1.5 py-0.5 rounded">{ph}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#E2E8F0] mb-3" />

                <Link to={`/projects/${p.id}`} data-testid={`project-link-${p.id}`} className="flex items-center justify-between text-xs text-[#2E60CC] font-ibm font-medium hover:underline">
                  <span className="flex items-center gap-1.5">
                    <Settings size={12} />
                    Gérer le projet
                  </span>
                  <ChevronRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Org Modal */}
      {showOrgModal && (
        <Modal title={t('org.create')} onClose={() => setShowOrgModal(false)}>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('org.name')} *</label>
              <input data-testid="org-name-input" className="ndm-input" value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('org.code')} *</label>
              <input data-testid="org-code-input" className="ndm-input font-mono-ibm uppercase" value={orgForm.code} onChange={e => setOrgForm({ ...orgForm, code: e.target.value.toUpperCase() })} placeholder="RCG" required />
              <p className="text-xs text-[#868E96] mt-1 font-ibm">{t('org.code_hint')}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('description')}</label>
              <textarea className="ndm-input resize-none" rows={2} value={orgForm.description} onChange={e => setOrgForm({ ...orgForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowOrgModal(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-md text-[#495057] hover:bg-[#F8F9FA] font-ibm">{t('cancel')}</button>
              <button data-testid="org-submit" type="submit" className="ndm-btn-primary">{t('create')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Project Modal */}
      {showProjModal && (
        <Modal title={editProject ? t('edit') : t('project.create')} onClose={() => setShowProjModal(false)}>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('project.name')} *</label>
              <input data-testid="project-name-input" className="ndm-input" value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('project.code')} *</label>
              <input data-testid="project-code-input" className="ndm-input font-mono-ibm uppercase" value={projForm.code} onChange={e => setProjForm({ ...projForm, code: e.target.value.toUpperCase() })} placeholder="PROJ1" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('description')}</label>
              <textarea className="ndm-input resize-none" rows={2} value={projForm.description} onChange={e => setProjForm({ ...projForm, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('project.phases')}</label>
              <p className="text-xs text-[#868E96] font-ibm mb-2">{t('project.phases_hint')}</p>
              <div className="flex gap-2 mb-2">
                <input className="ndm-input flex-1 font-mono-ibm uppercase" value={phaseInput} onChange={e => setPhaseInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhase())} placeholder="DES" />
                <button type="button" onClick={addPhase} className="ndm-btn-primary px-3">{t('add')}</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {projForm.phases.map((ph, i) => (
                  <span key={i} className="inline-flex items-center gap-1 font-mono-ibm text-xs bg-[#2E60CC]/10 text-[#2E60CC] px-2 py-0.5 rounded">
                    {ph}
                    <button type="button" onClick={() => setProjForm({ ...projForm, phases: projForm.phases.filter((_, j) => j !== i) })} className="hover:text-[#E50000]">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-md text-[#495057] hover:bg-[#F8F9FA] font-ibm">{t('cancel')}</button>
              <button data-testid="project-submit" type="submit" className="ndm-btn-primary">{editProject ? t('save') : t('create')}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-lg w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-chivo font-700 text-base text-[#121212]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96]" style={{ transition: 'background-color 150ms ease' }}>
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
