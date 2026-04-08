import { useState, useRef, useEffect } from 'react';

export const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const createWavHeader = (dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLength, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true);

    return header;
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
    }
  };

  const playAudio = async (base64Audio: string) => {
    if (!base64Audio || !audioRef.current) {
      console.warn("playAudio: No audio data or audio element");
      return;
    }

    stopAudio();

    try {
      const cleanedBase64 = base64Audio.replace(/\s/g, '');
      const binaryString = window.atob(cleanedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;

      const header = createWavHeader(bytes.length, sampleRate, numChannels, bitsPerSample);
      const wavBlob = new Blob([header, bytes], { type: 'audio/wav' });
      const wavUrl = URL.createObjectURL(wavBlob);

      const audio = audioRef.current;
      audio.src = wavUrl;
      audio.volume = volume;
      audio.muted = false;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        URL.revokeObjectURL(wavUrl);
      };

      audio.onerror = (e) => {
        console.error("Audio: Error occurred", e);
        setIsPlaying(false);
        URL.revokeObjectURL(wavUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const seek = (val: number) => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      const time = (val / 100) * audioRef.current.duration;
      if (!isNaN(time)) {
        audioRef.current.currentTime = time;
        setProgress(val);
      }
    }
  };

  const updateVolume = (val: number) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { 
    playAudio, 
    isPlaying, 
    progress, 
    duration, 
    volume, 
    setVolume: updateVolume, 
    togglePlayPause, 
    seek,
    stopAudio
  };
};
