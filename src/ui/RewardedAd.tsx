import { t } from '../i18n';
import { Icon } from './Icon';
export type AdReward={type:'coins'}|{type:'coin-pack'}|{type:'shake'}|{type:'revive'}|{type:'double'}|{type:'unlock';key:string};

/** Only a loading surface. The platform owns the ad and its close controls. */
export function RewardedAd({leaving=false}:{leaving?:boolean}) {
  return <div className={`ad-overlay ${leaving?'is-leaving':''}`} inert={leaving}>
    <div className="ad-dialog" role="status" aria-live="polite"><Icon name="video" size={55}/><p>{t('Загрузка рекламы…')}</p></div>
  </div>;
}
