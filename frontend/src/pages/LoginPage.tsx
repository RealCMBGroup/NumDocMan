import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, User, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', preferred_language: i18n.language });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form;
      const res = await api.post(endpoint, payload);
      login(res.data.token, res.data.user);
      toast.success(mode === 'login' ? t('auth.welcome_back') : t('success'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Industrial background */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1A2E5A 50%, #2E60CC 100%)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1610018924075-558aa6b0d7a9?crop=entropy&cs=srgb&fm=jpg&q=85)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.25,
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img
              src="https://customer-assets.emergentagent.com/job_doc-hub-pro/artifacts/5lgqesfz_favicon_RCG.png"
              alt="RealCMB Group"
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="font-chivo font-900 text-white text-2xl tracking-tight">NumDocMan</h1>
              <p className="text-white/60 text-xs font-ibm">by RealCMB Group</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#E50000]/20 border border-[#E50000]/40 rounded px-3 py-1.5">
              <div className="w-2 h-2 bg-[#E50000] rounded-full animate-pulse" />
              <span className="text-white/80 text-xs font-ibm uppercase tracking-widest">Document Management</span>
            </div>
            <h2 className="font-chivo font-700 text-white text-4xl lg:text-5xl leading-tight">
              Gérez votre<br />
              <span className="text-[#5B8FE8]">documentation</span><br />
              en toute sécurité
            </h2>
            <p className="text-white/60 text-base font-ibm leading-relaxed max-w-sm">
              Workflows personnalisés, signatures électroniques et KPIs pour toutes vos organisations.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Projets', value: 'Multi' },
              { label: 'Workflows', value: '100%' },
              { label: 'Conforme', value: 'RGPD' },
            ].map((item) => (
              <div key={item.label} className="border border-white/20 rounded-md p-3">
                <p className="font-chivo font-700 text-white text-xl">{item.value}</p>
                <p className="text-white/50 text-xs font-ibm mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-[#F8F9FA]">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src="https://customer-assets.emergentagent.com/job_doc-hub-pro/artifacts/5lgqesfz_favicon_RCG.png"
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
            <h1 className="font-chivo font-700 text-2xl text-[#121212]">NumDocMan</h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-chivo font-700 text-2xl text-[#121212] mb-1">
              {mode === 'login' ? t('auth.welcome_back') : t('auth.create_account')}
            </h2>
            <p className="text-[#868E96] text-sm font-ibm">{t('auth.login_subtitle')}</p>
          </div>

          {/* Language switcher */}
          <div className="flex gap-2 mb-6">
            {['fr', 'en'].map((lang) => (
              <button
                key={lang}
                data-testid={`lang-${lang}`}
                onClick={() => i18n.changeLanguage(lang)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-medium transition-colors duration-150 ${
                  i18n.language === lang
                    ? 'bg-[#2E60CC] text-white border-[#2E60CC]'
                    : 'bg-white text-[#495057] border-[#E2E8F0] hover:border-[#2E60CC] hover:text-[#2E60CC]'
                }`}
              >
                <Globe size={12} />
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button
            data-testid="google-login-btn"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#E2E8F0] rounded-md px-4 py-2.5 text-sm text-[#121212] font-ibm font-medium hover:border-[#CED4DA] hover:bg-[#F8F9FA] mb-4"
            style={{ transition: 'border-color 150ms ease, background-color 150ms ease' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('auth.google_login')}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px bg-[#E2E8F0] flex-1" />
            <span className="text-xs text-[#868E96] font-ibm">ou</span>
            <div className="h-px bg-[#E2E8F0] flex-1" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('auth.name')}</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868E96]" />
                  <input
                    data-testid="register-name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t('auth.name')}
                    className="ndm-input pl-9"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('auth.email')}</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868E96]" />
                <input
                  data-testid="login-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="ndm-input pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868E96]" />
                <input
                  data-testid="login-password"
                  type={showPwd ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="ndm-input pl-9 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#868E96] hover:text-[#495057]"
                  style={{ transition: 'color 150ms ease' }}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">{t('auth.language')}</label>
                <select
                  name="preferred_language"
                  value={form.preferred_language}
                  onChange={handleChange}
                  className="ndm-input"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            )}

            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full ndm-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed py-2.5"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {mode === 'login' ? t('auth.login') : t('auth.register')}
            </button>
          </form>

          <p className="text-center text-sm text-[#868E96] mt-6 font-ibm">
            {mode === 'login' ? t('auth.no_account') : t('auth.have_account')}{' '}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-[#2E60CC] font-medium hover:underline"
            >
              {mode === 'login' ? t('auth.register') : t('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
