import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { FileText, FolderKanban, PenSquare, Activity, TrendingUp } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#2E60CC', '#E50000', '#10B981', '#F59E0B', '#6366F1', '#EC4899'];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [data, setData] = useState(null);
  const [projectData, setProjectData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/organizations').then(res => {
      setOrgs(res.data);
      if (res.data.length > 0) setSelectedOrg(res.data[0].id);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOrg) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get('/kpi/overview', { params: { org_id: selectedOrg } }),
      api.get('/kpi/by-project', { params: { org_id: selectedOrg } }),
    ]).then(([overview, projects]) => {
      setData(overview.data);
      setProjectData(projects.data);
    }).catch(() => toast.error(t('errors.server_error')))
    .finally(() => setLoading(false));
  }, [selectedOrg, t]);

  const actionMap = {
    create: { label: t('history.create'), color: '#10B981' },
    upload: { label: t('history.upload'), color: '#2E60CC' },
    transition: { label: t('history.transition'), color: '#F59E0B' },
    sign: { label: t('history.sign'), color: '#6366F1' },
    edit: { label: t('history.edit'), color: '#868E96' },
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-chivo font-700 text-2xl text-[#121212]">{t('dashboard.title')}</h1>
            <p className="text-sm text-[#868E96] font-ibm mt-0.5">
              {t('auth.welcome_back')}, {user?.name}
            </p>
          </div>
          {orgs.length > 0 && (
            <select
              data-testid="org-selector"
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="ndm-input w-auto max-w-xs"
            >
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>

        {orgs.length === 0 && !loading && (
          <div className="ndm-card p-8 text-center">
            <FolderKanban size={40} className="text-[#CED4DA] mx-auto mb-3" />
            <p className="font-chivo font-700 text-[#121212] text-lg">{t('org.no_org')}</p>
            <p className="text-[#868E96] text-sm font-ibm mt-1">{t('org.create_first')}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#2E60CC] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: t('dashboard.total_documents'), value: data.total_documents, icon: FileText, color: '#2E60CC' },
                { label: t('dashboard.total_projects'), value: data.total_projects, icon: FolderKanban, color: '#E50000' },
                { label: t('dashboard.total_signatures'), value: data.total_signatures, icon: PenSquare, color: '#10B981' },
              ].map((item, idx) => (
                <div key={idx} data-testid={`kpi-card-${idx}`} className="ndm-card p-5 animate-fade-in-up" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-ibm font-medium text-[#868E96] uppercase tracking-wide">{item.label}</p>
                      <p className="font-chivo font-900 text-3xl text-[#121212] mt-1">{item.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: item.color + '15' }}>
                      <item.icon size={20} style={{ color: item.color }} />
                    </div>
                  </div>
                  <div className="h-px bg-[#E2E8F0] mt-3" />
                  <div className="mt-2 flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-[#10B981]" />
                    <span className="text-xs text-[#868E96] font-ibm">Active</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Documents by state */}
              <div className="ndm-card p-5 animate-fade-in-up stagger-2">
                <h3 className="font-chivo font-700 text-sm text-[#121212] mb-4">{t('dashboard.docs_by_state')}</h3>
                {data.docs_by_state.length === 0 ? (
                  <p className="text-sm text-[#868E96] font-ibm text-center py-8">{t('dashboard.no_data')}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.docs_by_state} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans', fill: '#868E96' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans', fill: '#868E96' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'IBM Plex Sans', border: '1px solid #E2E8F0', borderRadius: 6 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.docs_by_state.map((entry, i) => (
                          <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Documents by type */}
              <div className="ndm-card p-5 animate-fade-in-up stagger-3">
                <h3 className="font-chivo font-700 text-sm text-[#121212] mb-4">{t('dashboard.docs_by_type')}</h3>
                {data.docs_by_type.length === 0 ? (
                  <p className="text-sm text-[#868E96] font-ibm text-center py-8">{t('dashboard.no_data')}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.docs_by_type} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                        {data.docs_by_type.map((entry, i) => (
                          <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'IBM Plex Sans', border: '1px solid #E2E8F0', borderRadius: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Projects table + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Projects stats */}
              <div className="ndm-card overflow-hidden lg:col-span-3 animate-fade-in-up stagger-4">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                  <h3 className="font-chivo font-700 text-sm text-[#121212]">{t('dashboard.projects_by_status')}</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="table-dense">
                      <th className="text-left">{t('name')}</th>
                      <th className="text-left">{t('project.status')}</th>
                      <th className="text-right">{t('document.title')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectData.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-8 text-sm text-[#868E96] font-ibm">{t('dashboard.no_data')}</td></tr>
                    ) : (
                      projectData.map((p) => (
                        <tr key={p.project_id} className="table-dense">
                          <td>
                            <div>
                              <p className="font-medium text-[#121212] font-ibm">{p.name}</p>
                              <p className="text-xs text-[#868E96] font-mono-ibm">{p.code}</p>
                            </div>
                          </td>
                          <td>
                            <span className={`badge-state text-xs ${
                              p.status === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' :
                              p.status === 'archived' ? 'bg-[#868E96]/10 text-[#868E96]' :
                              'bg-[#F59E0B]/10 text-[#F59E0B]'
                            }`}>
                              {t(`project.${p.status}`) || p.status}
                            </span>
                          </td>
                          <td className="text-right font-chivo font-700 text-[#2E60CC]">{p.doc_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Recent activity */}
              <div className="ndm-card overflow-hidden lg:col-span-2 animate-fade-in-up stagger-4">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <Activity size={14} className="text-[#2E60CC]" />
                  <h3 className="font-chivo font-700 text-sm text-[#121212]">{t('dashboard.recent_activity')}</h3>
                </div>
                <div className="divide-y divide-[#E2E8F0] max-h-64 overflow-y-auto">
                  {data.recent_activity.length === 0 ? (
                    <p className="text-sm text-[#868E96] font-ibm text-center py-8">{t('dashboard.no_activity')}</p>
                  ) : (
                    data.recent_activity.map((a, i) => {
                      const act = actionMap[a.action] || { label: a.action, color: '#868E96' };
                      return (
                        <div key={i} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: act.color }} />
                            <span className="text-xs font-medium font-ibm" style={{ color: act.color }}>{act.label}</span>
                            <span className="text-[10px] text-[#868E96] font-ibm ml-auto">
                              {new Date(a.performed_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-[#121212] font-ibm truncate">{a.document_title}</p>
                          <p className="text-[10px] text-[#868E96] font-ibm mt-0.5">
                            {a.performed_by?.name}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
