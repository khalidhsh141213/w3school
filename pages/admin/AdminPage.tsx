import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminTablePage } from "@/components/admin/AdminTablePage';
import { useParams } from 'react-router-dom';

type AdminPageType = 'assets' | 'trades' | 'finances' | 'kyc';

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { type } = useParams<{ type: AdminPageType }>();

  const getPageTitle = () => {
    switch (type) {
      case 'assets':
        return t('admin.assetsManagement');
      case 'trades':
        return t('admin.tradesManagement');
      case 'finances':
        return t('admin.financesManagement');
      case 'kyc':
        return t('admin.kycManagement');
      default:
        return t('admin.management');
    }
  };

  if (!type) {
    return (
      <div className="alert alert-error">
        <span>{t('admin.invalidPageType')}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg mb-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold px-4">{t('admin.adminPanel')}</h1>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a href="/admin/assets">{t('admin.assets')}</a>
            </li>
            <li>
              <a href="/admin/trades">{t('admin.trades')}</a>
            </li>
            <li>
              <a href="/admin/finances">{t('admin.finances')}</a>
            </li>
            <li>
              <a href="/admin/kyc">{t('admin.kyc')}</a>
            </li>
          </ul>
        </div>
      </div>

      <AdminTablePage
        tableType={type}
        title={getPageTitle()}
      />
    </div>
  );
}; 