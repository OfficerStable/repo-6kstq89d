import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppLanguage, getLanguage, setLanguage as persistLanguage } from './index';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'zh',
  setLanguage: () => {},
  toggleLanguage: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(getLanguage());

  const setLanguage = useCallback((next: AppLanguage) => {
    persistLanguage(next);
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(getLanguage() === 'zh' ? 'en' : 'zh');
  }, [setLanguage]);

  const value = useMemo(() => ({ language, setLanguage, toggleLanguage }), [language, setLanguage, toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => useContext(LanguageContext);
