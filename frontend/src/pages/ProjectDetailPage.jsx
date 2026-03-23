import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, GitBranch, FileType, Fingerprint, Users } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/api';

const TABS = ['document_types', 'workflow', 'id_rule', 'members'];

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('document_types');
  const [loading, setLoading] = useState(true);

  // Document types state
  const [docTypes, setDocTypes] = useState([]);
  const [showDtModal, setShowDtModal] = useState(false);
  const [editDt, setEditDt] = useState(null);
  const [dtForm, setDtForm] = useState({ name: '', code: '', description: '', color: '#2E60CC', icon: 'FileText' });

  // Workflow states
  const [wfStates, setWfStates] = useState([]);
  const [wfTransitions, setWfTransitions] = useState([]);
  const [showStateModal, setShowStateModal] = useState(false);
  const [editState, setEditState] = useState(null);
  const [stateForm, setStateForm] = useState({ name: '', code: '', color: '#6B7280', is_initial: false, is_final: false, order: 0 });
  const [showTransModal, setShowTransModal] = useState(false);
  const [transForm, setTransForm] = useState({ from_state_id: '', to_state_id: '', name: '', requires_signature: false, requires_comment: false });

  // ID Rule
  const [idRule, setIdRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ pattern: '{org}_{proj}_{phase}_{type}_{seq:05d}', separator: '_', seq_digits: 5 });

  // Members
  const [members, setMembers] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [proj, dts, states, trans, mems] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/document-types`),
        api.get(`/projects/${projectId}/workflow-states`),
        api.get(`/projects/${projectId}/workflow-transitions`),
        api.get(`/projects/${projectId}/members`),
      ]);
      setProject(proj.data);
      setDocTypes(dts.data);
      setWfStates(states.data);
      setWfTransitions(trans.data);
      setMembers(mems.data);
      try {
        const rule = await api.get(`/projects/${projectId}/id-rule`);
        setIdRule(rule.data);
        setRuleForm({ pattern: rule.data.pattern, separator: rule.data.separator, seq_digits: rule.data.seq_digits });
      } catch {}
    } catch { toast.error(t('errors.server_error')); }
    finally { setLoading(false); }
  }, [projectId, t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Doc Type handlers
  const handleSaveDt = async (e) => {
    e.preventDefault();
    try {
      if (editDt) await api.put(`/projects/${projectId}/document-types/${editDt.id}`, dtForm);
      else await api.post(`/projects/${projectId}/document-types`, dtForm);
      toast.success(t('success'));
      setShowDtModal(false);
      setEditDt(null);
      const res = await api.get(`/projects/${projectId}/document-types`);
      setDocTypes(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteDt = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/projects/${projectId}/document-types/${id}`);
      setDocTypes(docTypes.filter(d => d.id !== id));
      toast.success(t('success'));
    } catch { toast.error(t('errors.server_error')); }
  };

  // Workflow state handlers
  const handleSaveState = async (e) => {
    e.preventDefault();
    try {
      if (editState) await api.put(`/projects/${projectId}/workflow-states/${editState.id}`, stateForm);
      else await api.post(`/projects/${projectId}/workflow-states`, stateForm);
      toast.success(t('success'));
      setShowStateModal(false);
      const res = await api.get(`/projects/${projectId}/workflow-states`);
      setWfStates(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteState = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/projects/${projectId}/workflow-states/${id}`);
      setWfStates(wfStates.filter(s => s.id !== id));
    } catch { toast.error(t('errors.server_error')); }
  };

  // Transition handlers
  const handleSaveTrans = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...transForm, from_state_id: transForm.from_state_id || null };
      await api.post(`/projects/${projectId}/workflow-transitions`, payload);
      toast.success(t('success'));
      setShowTransModal(false);
      const res = await api.get(`/projects/${projectId}/workflow-transitions`);
      setWfTransitions(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const handleDeleteTrans = async (id) => {
    if (!window.confirm(t('confirm') + '?')) return;
    try {
      await api.delete(`/projects/${projectId}/workflow-transitions/${id}`);
      setWfTransitions(wfTransitions.filter(tr => tr.id !== id));
    } catch { toast.error(t('errors.server_error')); }
  };

  // ID rule handler
  const handleSaveRule = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/projects/${projectId}/id-rule`, { ...ruleForm, seq_digits: parseInt(ruleForm.seq_digits) });
      setIdRule(res.data);
      toast.success(t('success'));
    } catch (err) { toast.error(err.response?.data?.detail || t('errors.unknown')); }
  };

  const getStateName = (id) => wfStates.find(s => s.id === id)?.name || t('workflow.any_state');

  if (loading) return <Layout><div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" /></div></Layout>;

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <Link to="/projects" className="flex items-center gap-1.5 text-sm text-[#868E96] hover:text-[#2E60CC] font-ibm mb-3" style={{ transition: 'color 150ms ease' }}>
            <ArrowLeft size={14} /> {t('back')}
          </Link>
          {project && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono-ibm text-xs text-[#868E96] uppercase">{project.code}</span>
                <span className={`badge-state text-xs ${project.status === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#868E96]/10 text-[#868E96]'}`}>
                  {t(`project.${project.status}`) || project.status}
                </span>
              </div>
              <h1 className="font-chivo font-700 text-2xl text-[#121212]">{project.name}</h1>
              {project.description && <p className="text-sm text-[#868E96] font-ibm mt-1">{project.description}</p>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#E2E8F0]">
          {TABS.map(tab => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-ibm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === tab ? 'border-[#2E60CC] text-[#2E60CC]' : 'border-transparent text-[#868E96] hover:text-[#495057]'
              }`}
            >
              {tab === 'document_types' ? t('project.document_types') :
               tab === 'workflow' ? t('project.workflow') :
               tab === 'id_rule' ? t('project.id_rule') :
               t('project.members')}
            </button>
          ))}
        </div>

        {/* Document Types Tab */}
        {activeTab === 'document_types' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-chivo font-700 text-base text-[#121212]">{t('doctype.title')}</h2>
              <button data-testid="add-doctype-btn" onClick={() => { setEditDt(null); setDtForm({ name: '', code: '', description: '', color: '#2E60CC', icon: 'FileText' }); setShowDtModal(true); }} className="ndm-btn-primary flex items-center gap-2 text-sm">
                <Plus size={14} /> {t('doctype.create')}
              </button>
            </div>
            {docTypes.length === 0 ? (
              <p className="text-sm text-[#868E96] font-ibm py-8 text-center">{t('doctype.no_types')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {docTypes.map(dt => (
                  <div key={dt.id} data-testid={`doctype-${dt.id}`} className="ndm-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dt.color }} />
                        <span className="font-mono-ibm text-xs text-[#868E96]">{dt.code}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditDt(dt); setDtForm({ name: dt.name, code: dt.code, description: dt.description || '', color: dt.color, icon: dt.icon }); setShowDtModal(true); }} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96]"><Pencil size={12} /></button>
                        <button onClick={() => handleDeleteDt(dt.id)} className="p-1 rounded hover:bg-red-50 text-[#868E96] hover:text-[#E50000]"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <p className="font-ibm font-medium text-sm text-[#121212]">{dt.name}</p>
                    {dt.description && <p className="text-xs text-[#868E96] font-ibm mt-1">{dt.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workflow Tab */}
        {activeTab === 'workflow' && (
          <div className="space-y-6">
            {/* States */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-chivo font-700 text-base text-[#121212]">{t('workflow.states')}</h2>
                <button data-testid="add-state-btn" onClick={() => { setEditState(null); setStateForm({ name: '', code: '', color: '#6B7280', is_initial: false, is_final: false, order: 0 }); setShowStateModal(true); }} className="ndm-btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> {t('workflow.create_state')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {wfStates.map(s => (
                  <div key={s.id} data-testid={`state-${s.id}`} className="ndm-card px-3 py-2 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-ibm text-sm text-[#121212]">{s.name}</span>
                    <span className="font-mono-ibm text-[10px] text-[#868E96]">({s.code})</span>
                    {s.is_initial && <span className="text-[9px] bg-[#10B981]/10 text-[#10B981] px-1 rounded">INIT</span>}
                    {s.is_final && <span className="text-[9px] bg-[#E50000]/10 text-[#E50000] px-1 rounded">FINAL</span>}
                    <div className="flex gap-1 ml-1">
                      <button onClick={() => { setEditState(s); setStateForm({ name: s.name, code: s.code, color: s.color, is_initial: s.is_initial, is_final: s.is_final, order: s.order }); setShowStateModal(true); }} className="p-0.5 hover:text-[#2E60CC] text-[#CED4DA]"><Pencil size={11} /></button>
                      <button onClick={() => handleDeleteState(s.id)} className="p-0.5 hover:text-[#E50000] text-[#CED4DA]"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transitions */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-chivo font-700 text-base text-[#121212]">{t('workflow.transitions')}</h2>
                <button data-testid="add-transition-btn" onClick={() => { setTransForm({ from_state_id: '', to_state_id: '', name: '', requires_signature: false, requires_comment: false }); setShowTransModal(true); }} className="ndm-btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> {t('workflow.create_transition')}
                </button>
              </div>
              <div className="ndm-card overflow-hidden">
                <table className="w-full">
                  <thead><tr className="table-dense"><th className="text-left">{t('workflow.transition_name')}</th><th className="text-left">{t('workflow.from_state')}</th><th className="text-left">{t('workflow.to_state')}</th><th className="text-left">Options</th><th /></tr></thead>
                  <tbody>
                    {wfTransitions.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-sm text-[#868E96] font-ibm">—</td></tr>
                    ) : (
                      wfTransitions.map(tr => (
                        <tr key={tr.id} className="table-dense">
                          <td className="font-ibm font-medium text-[#121212]">{tr.name}</td>
                          <td><span className="font-ibm text-sm text-[#868E96]">{tr.from_state_id ? getStateName(tr.from_state_id) : t('workflow.any_state')}</span></td>
                          <td><span className="font-ibm text-sm text-[#121212]">{getStateName(tr.to_state_id)}</span></td>
                          <td className="text-xs text-[#868E96] font-ibm">
                            {tr.requires_comment && <span className="mr-1">💬</span>}
                            {tr.requires_signature && <span>✍️</span>}
                          </td>
                          <td className="text-right">
                            <button onClick={() => handleDeleteTrans(tr.id)} className="p-1 rounded hover:bg-red-50 text-[#CED4DA] hover:text-[#E50000]"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ID Rule Tab */}
        {activeTab === 'id_rule' && (
          <div className="max-w-lg space-y-4">
            <h2 className="font-chivo font-700 text-base text-[#121212]">{t('id_rule.title')}</h2>
            {idRule && (
              <div className="ndm-card p-4 bg-[#F8F9FA]">
                <p className="text-xs text-[#868E96] font-ibm mb-1">{t('id_rule.example')}</p>
                <p className="font-mono-ibm text-sm text-[#2E60CC]">
                  {project?.org?.code || 'ORG'}_{project?.code || 'PROJ'}_PHASE_TYPE_00001
                </p>
                <p className="text-xs text-[#868E96] font-ibm mt-2">{t('id_rule.current_seq')}: <span className="font-mono-ibm text-[#121212]">{idRule.current_seq}</span></p>
              </div>
            )}
            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('id_rule.pattern')}</label>
                <input className="ndm-input font-mono-ibm" value={ruleForm.pattern} onChange={e => setRuleForm({ ...ruleForm, pattern: e.target.value })} />
                <p className="text-xs text-[#868E96] mt-1 font-ibm">{t('id_rule.pattern_hint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('id_rule.separator')}</label>
                  <input className="ndm-input font-mono-ibm" value={ruleForm.separator} onChange={e => setRuleForm({ ...ruleForm, separator: e.target.value })} maxLength={3} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('id_rule.seq_digits')}</label>
                  <input type="number" className="ndm-input" value={ruleForm.seq_digits} onChange={e => setRuleForm({ ...ruleForm, seq_digits: e.target.value })} min={3} max={10} />
                </div>
              </div>
              <button data-testid="save-rule-btn" type="submit" className="ndm-btn-primary">{t('save')}</button>
            </form>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <h2 className="font-chivo font-700 text-base text-[#121212]">{t('project.members')}</h2>
            <div className="ndm-card overflow-hidden">
              <table className="w-full">
                <thead><tr className="table-dense"><th className="text-left">{t('name')}</th><th className="text-left">{t('auth.email')}</th><th className="text-left">{t('admin.roles')}</th></tr></thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-6 text-sm text-[#868E96] font-ibm">—</td></tr>
                  ) : (
                    members.map(m => (
                      <tr key={m.id} className="table-dense">
                        <td className="font-ibm font-medium text-[#121212]">{m.user?.name}</td>
                        <td className="text-[#868E96] font-ibm">{m.user?.email}</td>
                        <td><span className="badge-state bg-[#2E60CC]/10 text-[#2E60CC]">{m.role_code}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DocType Modal */}
      {showDtModal && (
        <SimpleModal title={editDt ? t('edit') : t('doctype.create')} onClose={() => setShowDtModal(false)}>
          <form onSubmit={handleSaveDt} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('doctype.name')} *</label><input className="ndm-input" value={dtForm.name} onChange={e => setDtForm({ ...dtForm, name: e.target.value })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('doctype.code')} *</label><input className="ndm-input font-mono-ibm uppercase" value={dtForm.code} onChange={e => setDtForm({ ...dtForm, code: e.target.value.toUpperCase() })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('description')}</label><input className="ndm-input" value={dtForm.description} onChange={e => setDtForm({ ...dtForm, description: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('doctype.color')}</label><div className="flex items-center gap-2"><input type="color" className="h-8 w-16 border border-[#E2E8F0] rounded cursor-pointer" value={dtForm.color} onChange={e => setDtForm({ ...dtForm, color: e.target.value })} /><span className="font-mono-ibm text-xs text-[#868E96]">{dtForm.color}</span></div></div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowDtModal(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button><button type="submit" className="ndm-btn-primary">{t('save')}</button></div>
          </form>
        </SimpleModal>
      )}

      {/* State Modal */}
      {showStateModal && (
        <SimpleModal title={editState ? t('edit') : t('workflow.create_state')} onClose={() => setShowStateModal(false)}>
          <form onSubmit={handleSaveState} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.state_name')} *</label><input className="ndm-input" value={stateForm.name} onChange={e => setStateForm({ ...stateForm, name: e.target.value })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.state_code')} *</label><input className="ndm-input font-mono-ibm uppercase" value={stateForm.code} onChange={e => setStateForm({ ...stateForm, code: e.target.value.toUpperCase() })} required /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.color')}</label><input type="color" className="h-8 w-16 border border-[#E2E8F0] rounded cursor-pointer" value={stateForm.color} onChange={e => setStateForm({ ...stateForm, color: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.order')}</label><input type="number" className="ndm-input" value={stateForm.order} onChange={e => setStateForm({ ...stateForm, order: parseInt(e.target.value) })} /></div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-ibm cursor-pointer"><input type="checkbox" checked={stateForm.is_initial} onChange={e => setStateForm({ ...stateForm, is_initial: e.target.checked })} className="rounded" />{t('workflow.is_initial')}</label>
              <label className="flex items-center gap-2 text-sm font-ibm cursor-pointer"><input type="checkbox" checked={stateForm.is_final} onChange={e => setStateForm({ ...stateForm, is_final: e.target.checked })} className="rounded" />{t('workflow.is_final')}</label>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowStateModal(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button><button type="submit" className="ndm-btn-primary">{t('save')}</button></div>
          </form>
        </SimpleModal>
      )}

      {/* Transition Modal */}
      {showTransModal && (
        <SimpleModal title={t('workflow.create_transition')} onClose={() => setShowTransModal(false)}>
          <form onSubmit={handleSaveTrans} className="space-y-3">
            <div><label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.transition_name')} *</label><input className="ndm-input" value={transForm.name} onChange={e => setTransForm({ ...transForm, name: e.target.value })} required /></div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.from_state')}</label>
              <select className="ndm-input" value={transForm.from_state_id} onChange={e => setTransForm({ ...transForm, from_state_id: e.target.value })}>
                <option value="">{t('workflow.any_state')}</option>
                {wfStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1 font-ibm">{t('workflow.to_state')} *</label>
              <select className="ndm-input" value={transForm.to_state_id} onChange={e => setTransForm({ ...transForm, to_state_id: e.target.value })} required>
                <option value="">—</option>
                {wfStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-ibm cursor-pointer"><input type="checkbox" checked={transForm.requires_comment} onChange={e => setTransForm({ ...transForm, requires_comment: e.target.checked })} />{t('workflow.requires_comment')}</label>
              <label className="flex items-center gap-2 text-sm font-ibm cursor-pointer"><input type="checkbox" checked={transForm.requires_signature} onChange={e => setTransForm({ ...transForm, requires_signature: e.target.checked })} />{t('workflow.requires_signature')}</label>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowTransModal(false)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-md text-[#495057] font-ibm">{t('cancel')}</button><button type="submit" className="ndm-btn-primary">{t('save')}</button></div>
          </form>
        </SimpleModal>
      )}
    </Layout>
  );
}

function SimpleModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-md border border-[#E2E8F0] shadow-lg w-full max-w-md animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-chivo font-700 text-base text-[#121212]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F1F3F5] text-[#868E96] text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
