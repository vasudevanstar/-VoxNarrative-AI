import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Portuguese", "Italian", "Russian"
];

export const GlobalLanguageSelector = () => {
  const { narrationLanguage, setNarrationLanguage } = useLanguage();

  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 p-2 rounded-xl backdrop-blur-md shadow-2xl">
      <Globe className="w-4 h-4 text-emerald-500" />
      <select 
        value={narrationLanguage}
        onChange={(e) => setNarrationLanguage(e.target.value)}
        className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-zinc-300 focus:outline-none cursor-pointer"
      >
        {LANGUAGES.map(lang => (
          <option key={lang} value={lang} className="bg-zinc-900 text-white">
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
};
