import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  language?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export function useSpeechRecognition({
  onResult,
  onError,
  continuous = true,
  language = 'en-US',
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimResult = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimResult += result[0].transcript;
          }
        }

        setInterimTranscript(interimResult);

        if (finalTranscript) {
          onResult?.(finalTranscript.trim(), true);
          setInterimTranscript('');
        } else if (interimResult) {
          onResult?.(interimResult.trim(), false);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        // Don't treat these as fatal errors
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        
        onError?.(event.error);
        
        if (event.error === 'not-allowed') {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        // Auto-restart if still supposed to be listening
        if (isListening && continuous) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.log('Could not restart recognition');
            }
          }, 100);
        }
      };
    } else {
      setIsSupported(false);
      onError?.('Speech recognition is not supported in this browser');
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognitionRef.current?.stop();
    };
  }, [continuous, language, onResult, onError]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      onError?.('Speech recognition not initialized');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      onError?.('Could not access microphone. Please allow microphone access.');
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    setIsListening(false);
    recognitionRef.current?.stop();
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
  };
}
