import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthUser } from '../context/AuthContext';

type AccountInformationProps = {
  user: AuthUser | null;
};

export default function AccountInformation({ user }: AccountInformationProps) {
  const { t, i18n } = useTranslation();
  const preferredLanguage = user?.preferred_language;
  const preferredLanguageLabel = preferredLanguage === 'fr'
    ? t('settings.languages.fr')
    : preferredLanguage === 'en'
      ? t('settings.languages.en')
      : preferredLanguage || '—';
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const createdAtLabel = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleDateString(i18n.language)
    : '—';

  return (
    <section className="ndm-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <User size={16} className="text-[#2E60CC]" />
        <h2 className="font-chivo font-700 text-base text-[#121212]">
          {t('settings.account_information')}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#2E60CC]/10 border border-[#2E60CC]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={20} className="text-[#2E60CC]" />
          )}
        </div>
        <dl className="grid gap-2 text-sm font-ibm">
          <div>
            <dt className="text-xs text-[#868E96]">{t('settings.account_reference')}</dt>
            <dd className="text-[#121212] font-mono break-all">{user?.id || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#868E96]">{t('settings.profile_name')}</dt>
            <dd className="text-[#121212]">{user?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#868E96]">{t('settings.profile_email')}</dt>
            <dd className="text-[#121212]">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#868E96]">{t('auth.language')}</dt>
            <dd className="text-[#121212]">{preferredLanguageLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#868E96]">{t('settings.account_role')}</dt>
            <dd className="text-[#121212] font-medium">
              {user?.is_superadmin === true ? (
                <span className="badge-state inline-flex bg-[#E50000]/10 text-[#E50000] text-xs">
                  {t('settings.roles.global_admin')}
                </span>
              ) : (
                t('settings.roles.standard_user')
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#868E96]">{t('settings.account_created_at')}</dt>
            <dd className="text-[#121212]">{createdAtLabel}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
