import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, FileText, Settings, Shield,
  LogOut, ChevronLeft, ChevronRight, Globe, Bell, Menu, X, User
} from 'lucide-react';

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/projects', icon: FolderKanban, label: t('nav.projects') },
    { path: '/documents', icon: FileText, label: t('nav.documents') },
    ...(user?.is_superadmin ? [{ path: '/admin', icon: Shield, label: t('nav.admin') }] : []),
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-white border-r border-[#E2E8F0] ${mobile ? 'w-64' : collapsed ? 'w-16' : 'w-60'} transition-all duration-200`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 p-4 border-b border-[#E2E8F0] ${collapsed && !mobile ? 'justify-center' : ''}`}>
        <img
          src="https://customer-assets.emergentagent.com/job_doc-hub-pro/artifacts/5lgqesfz_favicon_RCG.png"
          alt="NumDocMan"
          className="h-8 w-8 object-contain flex-shrink-0"
        />
        {(!collapsed || mobile) && (
          <div>
            <h1 className="font-chivo font-700 text-[#121212] text-base leading-none">NumDocMan</h1>
            <p className="text-[#868E96] text-[10px] font-ibm mt-0.5">RealCMB Group</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              to={path}
              data-testid={`nav-${path.replace('/', '')}`}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${isActive ? 'active' : ''} ${collapsed && !mobile ? 'justify-center px-2' : ''}`}
              title={collapsed && !mobile ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {(!collapsed || mobile) && <span className="font-ibm">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-[#E2E8F0] space-y-1">
        {/* Language toggle */}
        <div className={`flex items-center gap-2 px-3 py-2 ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <Globe size={14} className="text-[#868E96] flex-shrink-0" />
          {(!collapsed || mobile) && (
            <div className="flex gap-1">
              {['fr', 'en'].map((lang) => (
                <button
                  key={lang}
                  data-testid={`sidebar-lang-${lang}`}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors duration-150 ${
                    i18n.language === lang ? 'bg-[#2E60CC] text-white' : 'text-[#868E96] hover:text-[#2E60CC]'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        <div className={`flex items-center gap-2 px-3 py-2 ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-[#2E60CC]/10 border border-[#2E60CC]/20 flex items-center justify-center flex-shrink-0">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <User size={14} className="text-[#2E60CC]" />
            )}
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#121212] truncate font-ibm">{user?.name}</p>
              <p className="text-[10px] text-[#868E96] truncate font-ibm">{user?.email}</p>
            </div>
          )}
        </div>

        <button
          data-testid="logout-btn"
          onClick={handleLogout}
          className={`sidebar-link text-[#E50000] hover:bg-red-50 hover:text-[#E50000] w-full ${collapsed && !mobile ? 'justify-center px-2' : ''}`}
          title={collapsed && !mobile ? t('auth.logout') : undefined}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {(!collapsed || mobile) && <span className="font-ibm">{t('auth.logout')}</span>}
        </button>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center shadow-sm hover:border-[#2E60CC] z-10"
          style={{ transition: 'border-color 150ms ease' }}
        >
          {collapsed ? <ChevronRight size={12} className="text-[#868E96]" /> : <ChevronLeft size={12} className="text-[#868E96]" />}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex relative flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 animate-slide-in">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white/70 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-30">
          <button
            data-testid="mobile-menu-btn"
            className="lg:hidden p-1.5 rounded-md hover:bg-[#F1F3F5]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} className="text-[#495057]" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="text-xs text-[#868E96] font-ibm hidden sm:block">
              {user?.name}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
