import { useState, useRef, useCallback } from 'react';

export type SpeechState = 'idle' | 'recording' | 'transcribing' | 'error';

export function useSpeech(onTranscript?: (text: string) => void) {
  const [state, setState] = useState<SpeechState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const available = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Reconnaissance vocale non disponible');
      setState('error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setState('recording');
        setError(null);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0]?.[0]?.transcript;
        setState('idle');
        if (text && onTranscript) {
          onTranscript(text);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech error', event.error);
        setError(event.error);
        setState('idle');
      };

      recognition.onend = () => {
        setState('idle');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setError(e?.message || 'Erreur micro');
      setState('error');
    }
  }, [onTranscript]);

  const stopRecording = useCallback(async (): Promise<string | undefined> => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState('idle');
    }
    return undefined;
  }, []);

  return {
    state,
    error,
    available,
    startRecording,
    stopRecording,
    isListening: state === 'recording',
  };
}
