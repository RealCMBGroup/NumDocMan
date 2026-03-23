import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Upload, Download, FileText, Search, History, PenSquare, ChevronDown, Eye, Tag, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import SignatureModal from '../components/SignatureModal';
import PDFViewerModal from '../components/PDFViewerModal';
import api from '../api/api';

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [wfStates, setWfStates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [filters, setFilters] = useState({ state_id: '', doc_type_id: '', search: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, per_page: 20 });

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showTransition, setShowTransition] = useState(null);
  const [showSignature, setShowSignature] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [showViewer, setShowViewer] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({ title: '', doc_type_id: '', phase: '', description: '', tags: [] });
  const [tagInput, setTagInput] = useState('');
  const [transitions, setTransitions] = useState([]);
  const [selectedTrans, setSelectedTrans] = useState('');
  const [transComment, setTransComment] = useState('');
  const [docHistory, setDocHistory] = useState([]);
  const [docSigs, setDocSigs] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/organizations').then(res => {
      setOrgs(res.data);
      if (res.data.length > 0) setSelectedOrg(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    api.get('/projects', { params: { org_id: selectedOrg } }).then(res => {
      setProjects(res.data);
      if (res.data.length > 0) setSelectedProject(res.data[0].id);
    });
  }, [selectedOrg]);

  useEffect(() => {
    if (!selectedProject) return;
    Promise.all([
      api.get(`/projects/${selectedProject}/document-types`),
      api.get(`/projects/${selectedProject}/workflow-states`),
    ]).then(([dts, states]) => {
      setDocTypes(dts.data);
      setWfStates(states.data);
    });
  }, [selectedProject]);

  const loadDocs = useCallback(async () => {
    if (!selectedProject) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = { project_id: selectedProject, page: currentPage, per_page: 20 };
      if (filters.state_id) params.state_id = filters.state_id;
      if (filters.doc_type_id) params.doc_type_id = filters.doc_type_id;
      if (filters.search) params.search = filters.search;
      const res = await api.get('/documents', { params });
      setDocuments(res.data.items);
      setPagination({ total: res.data.total, pages: res.data.pages, per_page: res.data.per_page });
    } catch { toast.error(t('errors.server_error')); }
    finally { setLoading(false); }
  }, [selectedProject, filters, currentPage, t]);

  useEffect(() => { if (selectedProject) loadDocs(); }, [selectedProject, filters, currentPage]);

  // Reset page when filters or project change
  useEffect(() => { setCurrentPage(1); }, [selectedProject, filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/documents', { ...createForm, project_id: selectedProject, doc_type_id: createForm.doc_type_id || null });
      toast.success(t('success'));
      setShowCreate(false);
      setCreateForm({ title: '', doc_type_id: '', phase: '', description: '', tags: [] });
      loadDocs();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleUpload = async (docId) => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      await api.post(`/documents/${docId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('success'));
      setUploadFile(null);
      loadDocs();
    } catch { toast.error(t('errors.server_error')); }
    finally { setUploading(false); }
  };

  const handleTransition = async () => {
    if (!selectedTrans || !showTransition) return;
    try {
      const trans = transitions.find(t => t.id === selectedTrans);
      if (trans?.requires_comment && !transComment) { toast.error(t('workflow.requires_comment')); return; }
      await api.post(`/documents/${showTransition.id}/transition`, { to_state_id: trans.to_state_id, comment: transComment });
      toast.success(t('success'));
      setShowTransition(null);
      setSelectedTrans('');
      setTransComment('');
      loadDocs();
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const openTransition = async (doc) => {
    setShowTransition(doc);
    const res = await api.get(`/projects/${doc.project_id}/workflow-transitions`);
    const available = res.data.filter(tr => !tr.from_state_id || tr.from_state_id === doc.current_state_id);
    setTransitions(available);
  };

  const openHistory = async (doc) => {
    const [hist, sigs] = await Promise.all([
      api.get(`/documents/${doc.id}/history`),
      api.get(`/documents/${doc.id}/signatures`),
    ]);
    setDocHistory(hist.data);
    setDocSigs(sigs.data);
    setShowHistory(doc);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success(t('success'));
      loadDocs();
    } catch { toast.error(t('errors.server_error')); }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setCreateForm({ ...createForm, tags: [...createForm.tags, tagInput.trim()] });
    setTagInput('');
  };

  const phases = projects.find(p => p.id === selectedProject)?.phases || [];

  const actionColor = { create: '#10B981', upload: '#2E60CC', transition: '#F59E0B', sign: '#6366F1', edit: '#868E96' };

  return (
    <Layout>
      <div className="p-6 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-chivo font-700 text-2xl text-[#121212]">{t('document.title')}</h1>
          <button data-testid="create-doc-btn" onClick={() => setShowCreate(true)} disabled={!selectedProject} className="ndm-btn-primary flex items-center gap-2 disabled:opacity-50">
            <Plus size={15} /> {t('document.create')}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {orgs.length > 0 && (
            <select data-testid="doc-org-selector" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)} className="ndm-input w-auto">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {projects.length > 0 && (
            <select data-testid="doc-project-selector" value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="ndm-input w-auto">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#868E96]" />
            <input data-testid="doc-search" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder={t('search') + '...'} className="ndm-input pl-8 w-44" />
          </div>
          {wfStates.length > 0 && (
            <select value={filters.state_id} onChange={e => setFilters({ ...filters, state_id: e.target.value })} className="ndm-input w-auto">
              <option value="">{t('all')} {t('document.state')}</option>
              {wfStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {docTypes.length > 0 && (
            <select value={filters.doc_type_id} onChange={e => setFilters({ ...filters, doc_type_id: e.target.value })} className="ndm-input w-auto">
              <option value="">{t('all')} {t('document.doc_type')}</option>
              {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
          )}
        </div>

        {/* Documents table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="ndm-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-dense">
                  <th className="text-left">{t('document.doc_id')}</th>
                  <th className="text-left">{t('document.doc_title')}</th>
                  <th className="text-left hidden md:table-cell">{t('document.doc_type')}</th>
                  <th className="text-left hidden md:table-cell">{t('document.state')}</th>
                  <th className="text-left hidden lg:table-cell">{t('document.version')}</th>
                  <th className="text-left hidden lg:table-cell">{t('document.file')}</th>
                  <th className="text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10">
                    <FileText size={32} className="text-[#CED4DA] mx-auto mb-2" />
                    <p className="text-sm text-[#868E96] font-ibm">{t('document.no_documents')}</p>
                  </td></tr>
                ) : (
                  documents.map((doc, i) => (
                    <tr key={doc.id} data-testid={`doc-row-${doc.id}`} className="table-dense">
                      <td>
                        <span className="font-mono-ibm text-xs bg-[#F1F3F5] text-[#495057] px-2 py-0.5 rounded">{doc.doc_id}</span>
                      </td>
                      <td>
                        <div>
                          <p className="font-ibm font-medium text-[#121212] truncate max-w-[180px]">{doc.title}</p>
                          {doc.phase && <p className="text-[10px] text-[#868E96] font-mono-ibm">{doc.phase}</p>}
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        {doc.doc_type ? (
                          <span className="badge-state text-xs font-ibm" style={{ backgroundColor: doc.doc_type.color + '20', color: doc.doc_type.color }}>
                            {doc.doc_type.name}
                          </span>
                        ) : <span className="text-[#CED4DA] text-xs">—</span>}
                      </td>
                      <td className="hidden md:table-cell">
                        {doc.current_state ? (
                          <span className="badge-state text-xs font-ibm" style={{ backgroundColor: doc.current_state.color + '20', color: doc.current_state.color }}>
                            {doc.current_state.name}
                          </span>
                        ) : <span className="text-[#CED4DA] text-xs">—</span>}
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="font-mono-ibm text-xs text-[#868E96]">v{doc.version} rev.{doc.revision}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        {doc.has_file ? (
                          <button onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download`)} className="text-xs text-[#2E60CC] hover:underline font-ibm flex items-center gap-1">
                            <Download size={11} /> {doc.file_name?.substring(0, 15)}{doc.file_name?.length > 15 ? '...' : ''}
                          </button>
                        ) : (
                          <span className="text-[#CED4DA] text-xs">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {doc.has_file && (
                            <button
                              data-testid={`view-btn-${doc.id}`}
                              onClick={() => setShowViewer(doc)}
                              title={t('view')}
                              className="p-1.5 rounded hover:bg-[#2E60CC]/10 text-[#868E96] hover:text-[#2E60CC]"
                              style={{ transition: 'background-color 150ms ease, color 150ms ease' }}
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button data-testid={`transition-btn-${doc.id}`} onClick={() => openTransition(doc)} title={t('document.transition')} className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]" style={{ transition: 'background-color 150ms ease' }}>
                            <ChevronDown size={14} />
                          </button>
                          <button data-testid={`sign-btn-${doc.id}`} onClick={() => setShowSignature(doc)} title={t('sign')} className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]" style={{ transition: 'background-color 150ms ease' }}>
                            <PenSquare size={14} />
                          </button>
                          <button data-testid={`history-btn-${doc.id}`} onClick={() => openHistory(doc)} title={t('document.history')} className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96]" style={{ transition: 'background-color 150ms ease' }}>
                            <History size={14} />
                          </button>
                          <label className="p-1.5 rounded hover:bg-[#F1F3F5] text-[#868E96] cursor-pointer" title={t('upload')} style={{ transition: 'background-color 150ms ease' }}>
                            <Upload size={14} />
                            <input type="file" className="hidden" onChange={async (e) => { setUploadFile(e.target.files[0]); await handleUpload(doc.id); }} />
                          </label>
                          <button data-testid={`delete-doc-${doc.id}`} onClick={() => handleDelete(doc.id)} className="p-1.5 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]" style={{ transition: 'background-color 150ms ease, color 150ms ease' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-[#868E96] font-ibm">
              {((currentPage - 1) * pagination.per_page) + 1}–{Math.min(currentPage * pagination.per_page, pagination.total)} sur {pagination.total} résultat{pagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <button
                data-testid="pagination-prev"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-[#E2E8F0] text-[#495057] hover:bg-[#F1F3F5] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ transition: 'background-color 150ms ease' }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.pages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-[#868E96] text-xs font-ibm">…</span>
                  ) : (
                    <button
                      key={item}
                      data-testid={`pagination-page-${item}`}
                      onClick={() => setCurrentPage(item)}
                      className={`w-8 h-8 text-xs rounded border font-ibm transition-colors duration-150 ${
                        currentPage === item
                          ? 'bg-[#2E60CC] text-white border-[#2E60CC]'
                          : 'bg-white text-[#495057] border-[#E2E8F0] hover:bg-[#F1F3F5]'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )
              }

              <button
                data-testid="pagination-next"
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
                className="p-1.5 rounded border border-[#E2E8F0] text-[#495057] hover:bg-[#F1F3F5] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ transition: 'background-color 150ms ease' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Document Modal */}
      {showCreate && (
        <DocModal title={t('document.create')} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('document.doc_title')} *</label>
              <input data-testid="doc-title-input" className="ndm-input" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('document.doc_type')}</label>
                <select data-testid="doc-type-select" className="ndm-input" value={createForm.doc_type_id} onChange={e => setCreateForm({ ...createForm, doc_type_id: e.target.value })}>
                  <option value="">—</option>
                  {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('document.phase')}</label>
                {phases.length > 0 ? (
                  <select data-testid="doc-phase-select" className="ndm-input" value={createForm.phase} onChange={e => setCreateForm({ ...createForm, phase: e.target.value })}>
                    <option value="">—</option>
                    {phases.map(ph => <option key={ph} value={ph}>{ph}</option>)}
                  </select>
                ) : (
                  <input className="ndm-input font-mono-ibm uppercase" value={createForm.phase} onChange={e => setCreateForm({ ...createForm, phase: e.target.value.toUpperCase() })} placeholder="PHASE" />
                )}
              </div>
            </div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('description')}</label>
              <textarea className="ndm-input resize-none" rows={2} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} /></div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('document.tags')}</label>
              <div className="flex gap-2 mb-1.5">
                <input className="ndm-input flex-1" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="tag..." />
                <button type="button" onClick={addTag} className="ndm-btn-primary px-3 text-sm">{t('add')}</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {createForm.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-[#F1F3F5] text-[#495057] px-2 py-0.5 rounded font-ibm">
                    <Tag size={10} />{tag}
                    <button type="button" onClick={() => setCreateForm({ ...createForm, tags: createForm.tags.filter((_, j) => j !== i) })} className="hover:text-[#E50000]">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button>
              <button data-testid="doc-submit" type="submit" className="ndm-btn-primary">{t('create')}</button>
            </div>
          </form>
        </DocModal>
      )}

      {/* Transition Modal */}
      {showTransition && (
        <DocModal title={t('document.transition')} onClose={() => setShowTransition(null)}>
          <div className="space-y-3">
            <p className="text-sm font-ibm text-[#495057]">
              {t('document.doc_id')}: <span className="font-mono-ibm text-[#121212]">{showTransition.doc_id}</span>
            </p>
            <p className="text-sm font-ibm text-[#495057]">
              {t('document.state')}: <span className="font-medium text-[#121212]">{showTransition.current_state?.name || '—'}</span>
            </p>
            {transitions.length === 0 ? (
              <p className="text-sm text-[#868E96] font-ibm py-4 text-center">Aucune transition disponible</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('workflow.select_transition')} *</label>
                  <select data-testid="transition-select" className="ndm-input" value={selectedTrans} onChange={e => setSelectedTrans(e.target.value)}>
                    <option value="">—</option>
                    {transitions.map(tr => (
                      <option key={tr.id} value={tr.id}>{tr.name} → {wfStates.find(s => s.id === tr.to_state_id)?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('workflow.comment')}</label>
                  <textarea data-testid="transition-comment" className="ndm-input resize-none" rows={2} value={transComment} onChange={e => setTransComment(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowTransition(null)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button>
              <button data-testid="confirm-transition-btn" onClick={handleTransition} disabled={!selectedTrans} className="ndm-btn-primary disabled:opacity-50">{t('workflow.confirm_transition')}</button>
            </div>
          </div>
        </DocModal>
      )}

      {/* History Modal */}
      {showHistory && (
        <DocModal title={`${t('document.history')} - ${showHistory.doc_id}`} onClose={() => setShowHistory(null)}>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* History */}
            <div>
              <h3 className="font-chivo font-700 text-sm text-[#121212] mb-3">{t('document.history')}</h3>
              <div className="space-y-2">
                {docHistory.map((h) => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: actionColor[h.action] || '#868E96' }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-ibm font-medium text-[#121212]">{t(`history.${h.action}`) || h.action}</span>
                        {h.from_state && <span className="text-[#868E96] text-xs">← {h.from_state.name}</span>}
                        {h.to_state && <span className="text-[#121212] text-xs font-medium">→ {h.to_state.name}</span>}
                      </div>
                      {h.comment && <p className="text-xs text-[#868E96] font-ibm mt-0.5">{h.comment}</p>}
                      <p className="text-[10px] text-[#CED4DA] font-ibm">{h.performed_by?.name} · {new Date(h.performed_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {docHistory.length === 0 && <p className="text-sm text-[#868E96] font-ibm">—</p>}
              </div>
            </div>
            {/* Signatures */}
            <div>
              <h3 className="font-chivo font-700 text-sm text-[#121212] mb-3">{t('document.signatures')}</h3>
              {docSigs.length === 0 ? (
                <p className="text-sm text-[#868E96] font-ibm">{t('signature.no_signatures')}</p>
              ) : (
                docSigs.map(sig => (
                  <div key={sig.id} className="ndm-card p-3 mb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-ibm font-medium text-sm text-[#121212]">{sig.title ? `${sig.title} ` : ''}{sig.name}</p>
                        <p className="text-xs text-[#868E96] font-ibm">{sig.company}{sig.entity ? ` · ${sig.entity}` : ''}</p>
                        <p className="text-xs text-[#868E96] font-ibm">{sig.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#868E96] font-ibm">{new Date(sig.signed_at).toLocaleString()}</p>
                        <p className="text-[10px] text-[#CED4DA] font-ibm">{sig.timezone}</p>
                      </div>
                    </div>
                    {sig.signature_type === 'drawn' && sig.signature_data && (
                      <img src={sig.signature_data} alt="signature" className="h-12 mt-2 border border-[#E2E8F0] rounded" />
                    )}
                    {sig.signature_type === 'type' && sig.signature_data && (
                      <p className="text-xl mt-2 font-ibm" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{sig.signature_data}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end mt-3 pt-3 border-t border-[#E2E8F0]">
            <button onClick={() => setShowHistory(null)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('close')}</button>
          </div>
        </DocModal>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <SignatureModal
          documentId={showSignature.id}
          onClose={() => setShowSignature(null)}
          onSigned={loadDocs}
        />
      )}

      {/* PDF Viewer Modal */}
      {showViewer && (
        <PDFViewerModal
          doc={showViewer}
          onClose={() => setShowViewer(null)}
          onSign={(doc) => { setShowViewer(null); setShowSignature(doc); }}
        />
      )}
    </Layout>
  );
}

function DocModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-chivo font-700 text-base text-[#121212]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96] text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
