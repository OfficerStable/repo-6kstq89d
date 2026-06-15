import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import { BrowserRouter } from 'react-router-dom';
import Auth0ProviderWithHistory from './components/Auth/Auth.tsx';
import App from './App.tsx';
import { SKIP_AUTH } from './utils/Constants.ts';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext.tsx';

// Remounting the whole app on language change guarantees every component
// (including ones that read translations outside of React hooks) re-renders
// with the newly selected language.
const Root = () => {
  const { language } = useLanguage();
  return (
    <BrowserRouter key={language}>
      {SKIP_AUTH ? (
        <App />
      ) : (
        <Auth0ProviderWithHistory>
          <App />
        </Auth0ProviderWithHistory>
      )}
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <Root />
  </LanguageProvider>
);
