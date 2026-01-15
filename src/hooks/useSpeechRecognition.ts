import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
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
  onStatusChange,
  continuous = true,
  language = 'en-US',
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      console.log('✅ Speech recognition supported');
      
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;

      recognitionRef.current.onstart = () => {
        console.log('🎤 Speech recognition started');
        onStatusChange?.('started');
      };

      recognitionRef.current.onaudiostart = () => {
        console.log('🔊 Audio capture started');
        onStatusChange?.('audio_started');
      };

      recognitionRef.current.onsoundstart = () => {
        console.log('🔈 Sound detected');
        onStatusChange?.('sound_detected');
      };

      recognitionRef.current.onspeechstart = () => {
        console.log('🗣️ Speech detected');
        onStatusChange?.('speech_detected');
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimResult = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
            console.log('📝 Final transcript:', result[0].transcript);
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

      recognitionRef.current.onspeechend = () => {
        console.log('🔇 Speech ended');
        onStatusChange?.('speech_ended');
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('❌ Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing to listen...');
          onStatusChange?.('no_speech');
          return;
        }
        
        if (event.error === 'aborted') {
          console.log('Recognition aborted');
          return;
        }
        
        onError?.(event.error);
        
        if (event.error === 'not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🔴 Recognition ended, isListening:', isListeningRef.current);
        
        if (isListeningRef.current && continuous) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              console.log('🔄 Restarting recognition...');
              recognitionRef.current?.start();
            } catch (e) {
              console.log('Could not restart recognition:', e);
            }
          }, 100);
        }
      };
    } else {
      setIsSupported(false);
      console.error('❌ Speech recognition NOT supported');
      onError?.('Speech recognition is not supported in this browser');
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognitionRef.current?.stop();
    };
  }, [continuous, language]);

  // Update callbacks without recreating recognition
  useEffect(() => {
    if (!recognitionRef.current) return;
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimResult = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          console.log('📝 Final transcript:', result[0].transcript);
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
  }, [onResult]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      onError?.('Speech recognition not initialized');
      return;
    }

    try {
      console.log('🎤 Requesting microphone access...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');
      
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      onError?.('Could not access microphone. Please allow microphone access.');
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    console.log('⏹️ Stopping recognition');
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    setIsListening(false);
    isListeningRef.current = false;
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
