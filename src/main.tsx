import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-ext-800.css';
import '@fontsource/nunito/latin-ext-900.css';
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';
import App from './App';
import './style.css';
import './ui/shop.css';
import './ui/rewards.css';
import { initYandexSDK, getPlatformLanguage } from './platform/yandexSdk';
import { initializeLanguage } from './i18n';

void initYandexSDK().then(() => {
  initializeLanguage(getPlatformLanguage());
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
});
