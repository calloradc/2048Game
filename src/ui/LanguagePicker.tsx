import { LANGUAGES, setLanguage, t, type Language } from '../i18n';

function Flag({language}:{language:Language}) {
  return <svg viewBox="0 0 30 20" className="language-flag" aria-hidden="true">
    {language==='ru'?<><path fill="#fff" d="M0 0h30v20H0z"/><path fill="#3263b4" d="M0 6.67h30v6.66H0z"/><path fill="#df4c53" d="M0 13.33h30V20H0z"/></>:
    language==='en'?<><path fill="#365582" d="M0 0h30v20H0z"/><path stroke="#fff" strokeWidth="4" d="m0 0 30 20M30 0 0 20"/><path stroke="#d94d59" strokeWidth="1.7" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" strokeWidth="6" d="M15 0v20M0 10h30"/><path stroke="#d94d59" strokeWidth="3.4" d="M15 0v20M0 10h30"/></>:
    language==='tr'?<><path fill="#dc4651" d="M0 0h30v20H0z"/><circle fill="#fff" cx="11.8" cy="10" r="6"/><circle fill="#dc4651" cx="13.6" cy="9.3" r="4.8"/><path fill="#fff" d="m20.1 6.5.9 2.5 2.7.1-2.1 1.6.7 2.6-2.2-1.5-2.2 1.5.8-2.6-2.2-1.6 2.7-.1z"/></>:
    language==='it'?<><path fill="#fff" d="M0 0h30v20H0z"/><path fill="#45976c" d="M0 0h10v20H0z"/><path fill="#dc535c" d="M20 0h10v20H20z"/></>:
    <><path fill="#429365" d="M0 0h30v20H0z"/><path fill="#f4d169" d="m15 3 12 7-12 7-12-7z"/><circle fill="#3e648e" cx="15" cy="10" r="4.6"/><path d="M10.6 8.9q4.6-.3 8.7 2.3" stroke="#fff" strokeWidth="1" fill="none"/></>}
  </svg>;
}
export function LanguagePicker({language}:{language:Language}) {
  return <div className="language-setting"><span>{t('Язык')}</span><div className="language-buttons" role="group" aria-label={t('Язык')}>
    {LANGUAGES.map(([code,name])=><button key={code} className="language-button" data-language={code} aria-label={name} title={name} aria-pressed={language===code} onClick={()=>setLanguage(code)}><Flag language={code}/><span>{code.toUpperCase()}</span></button>)}
  </div></div>;
}
