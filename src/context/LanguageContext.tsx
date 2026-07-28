import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'ar' | 'en';

const LanguageContext = createContext<{ lang: Lang; toggleLang: () => void }>({
  lang: 'ar',
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ar';
    return (localStorage.getItem('youchem_lang') as Lang) || 'ar';
  });

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('youchem_lang', lang);
  }, [lang]);

  const toggleLang = () => setLang(l => (l === 'ar' ? 'en' : 'ar'));

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
