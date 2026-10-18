import { FormEvent, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import api from '../api/api';

export default function PasswordRecoveryPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isReset = location.pathname === '/reset-password';
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReset && password !== confirmPassword) {
      toast.error(t('auth.password_mismatch'));
      return;
    }

    setLoading(true);
    try {
      if (isReset) {
        await api.post('/auth/password-reset/confirm', { token, password });
        toast.success(t('auth.password_reset_success'));
      } else {
        await api.post('/auth/password-reset/request', { email });
        toast.success(t('auth.reset_email_sent'));
      }
    } catch (error) {
      if (isReset && error.response?.status === 400) {
        toast.error(t('auth.reset_link_expired'));
      } else {
        toast.error(error.response?.data?.detail || t('errors.unknown'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8F9FA]">
      <main className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <h1 className="font-chivo font-700 text-2xl text-[#121212] mb-2">
          {isReset ? t('auth.reset_password') : t('auth.forgot_password')}
        </h1>
        <p className="text-[#868E96] text-sm font-ibm mb-6">
          {isReset ? t('auth.reset_password_subtitle') : t('auth.forgot_password_subtitle')}
        </p>

        {isReset && !token ? (
          <p role="alert" className="text-sm text-red-600 font-ibm">{t('auth.reset_link_expired')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isReset ? (
              <>
                <div>
                  <label htmlFor="new-password" className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">
                    {t('auth.new_password')}
                  </label>
                  <input
                    id="new-password"
                    data-testid="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    className="ndm-input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">
                    {t('auth.confirm_password')}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    className="ndm-input"
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="recovery-email" className="block text-xs font-medium text-[#495057] mb-1.5 font-ibm">
                  {t('auth.email')}
                </label>
                <input
                  id="recovery-email"
                  data-testid="recovery-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="monadresse@example.com"
                  className="ndm-input"
                  required
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full ndm-btn-primary disabled:opacity-60 disabled:cursor-not-allowed py-2.5"
            >
              {loading ? t('loading') : isReset ? t('auth.reset_password') : t('auth.send_reset_link')}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#868E96] mt-6 font-ibm">
          <Link to="/login" className="text-[#2E60CC] font-medium hover:underline">
            {t('auth.back_to_login')}
          </Link>
        </p>
      </main>
    </div>
  );
}
