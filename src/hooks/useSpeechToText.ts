import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en-US',
  'Tamil': 'ta-IN',
  'Spanish': 'es-ES',
  'French': 'fr-FR',
  'German': 'de-DE',
  'Hindi': 'hi-IN',
  'Japanese': 'ja-JP',
  'Chinese': 'zh-CN',
  'Russian': 'ru-RU',
  'Portuguese': 'pt-BR',
  'Italian': 'it-IT',
  'Arabic': 'ar-SA',
  'Korean': 'ko-KR',
  'Dutch': 'nl-NL',
  'Turkish': 'tr-TR',
  'Vietnamese': 'vi-VN'
};

export const useSpeechToText = (overrideLang?: string) => {
  const { narrationLanguage } = useLanguage();
  const langName = overrideLang || narrationLanguage;
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = LANGUAGE_MAP[langName] || 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
    };
    recognition.onerror = (event: any) => setError(event.error);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [langName]);

  return { transcript, isListening, error, startListening, setTranscript };
};
