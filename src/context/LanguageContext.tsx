import React, { createContext, useContext, useState, ReactNode } from 'react';

type LanguageContextType = {
  narrationLanguage: string;
  setNarrationLanguage: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [narrationLanguage, setNarrationLanguage] = useState('English');

  return (
    <LanguageContext.Provider value={{ narrationLanguage, setNarrationLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
