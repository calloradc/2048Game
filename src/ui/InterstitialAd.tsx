import { t } from '../i18n';
export function InterstitialAd() {
  return <div className="interstitial-overlay" role="status" aria-live="polite"><p>{t('Загрузка рекламы…')}</p></div>;
}
