import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { SuggestionCard } from './SuggestionCard';
import { SalesStageIndicator } from './SalesStageIndicator';
import { TranscriptPanel } from './TranscriptPanel';
import { ListeningIndicator } from './ListeningIndicator';
import { SettingsPanel } from './SettingsPanel';
import { Phone, PhoneOff, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptEntry {
  id: string;
  role: 'caller' | 'suggestion';
  text: string;
  timestamp: Date;
}

interface CallSettings {
  goal: string;
  style: string;
  customStyle: string;
}

interface AIResponse {
  suggestion: string;
  stage: string;
  tip: string;
  callerSentiment: 'positive' | 'neutral' | 'hesitant' | 'negative';
}

export function CallAssistant() {
  const { toast } = useToast();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState('greeting');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<AIResponse>({
    suggestion: "Hi! Thanks for picking up. Do you have a quick moment?",
    stage: 'greeting',
    tip: 'Be warm and ask permission to talk',
    callerSentiment: 'neutral',
  });
  const [settings, setSettings] = useState<CallSettings>({
    goal: 'Get them interested in learning more',
    style: 'warm',
    customStyle: '',
  });

  const lastProcessedRef = useRef<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const processTranscript = useCallback(async (text: string) => {
    // Avoid processing the same text twice
    if (text === lastProcessedRef.current || text.length < 3) return;
    lastProcessedRef.current = text;

    setIsProcessing(true);

    try {
      const styleText = settings.style === 'custom' ? settings.customStyle : settings.style;
      
      const { data, error } = await supabase.functions.invoke('sales-assistant', {
        body: {
          transcript: text,
          goal: settings.goal,
          style: styleText,
          currentStage,
          conversationHistory: transcript.slice(-6).map(t => ({
            role: t.role,
            text: t.text,
          })),
        },
      });

      if (error) throw error;

      console.log('AI Response:', data);

      if (data.suggestion) {
        setCurrentSuggestion({
          suggestion: data.suggestion,
          stage: data.stage || currentStage,
          tip: data.tip || '',
          callerSentiment: data.callerSentiment || 'neutral',
        });

        if (data.stage && data.stage !== currentStage) {
          setCurrentStage(data.stage);
        }
      }
    } catch (error) {
      console.error('Error getting suggestion:', error);
      toast({
        title: 'Connection issue',
        description: 'Still listening, trying again...',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [settings, currentStage, transcript, toast]);

  const handleSpeechResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal && text.trim().length > 0) {
      // Add to transcript
      const newEntry: TranscriptEntry = {
        id: Date.now().toString(),
        role: 'caller',
        text: text.trim(),
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, newEntry]);

      // Debounce AI call to avoid too many requests
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        processTranscript(text.trim());
      }, 500);
    }
  }, [processTranscript]);

  const handleSpeechError = useCallback((error: string) => {
    console.error('Speech error:', error);
    if (error === 'not-allowed') {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use the call assistant.',
        variant: 'destructive',
      });
      setIsCallActive(false);
    }
  }, [toast]);

  const { isListening, isSupported, interimTranscript, startListening, stopListening } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: handleSpeechError,
    continuous: true,
  });

  const startCall = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'Not supported',
        description: 'Speech recognition is not supported in this browser. Try Chrome or Edge.',
        variant: 'destructive',
      });
      return;
    }

    setIsCallActive(true);
    setTranscript([]);
    setCurrentStage('greeting');
    setCurrentSuggestion({
      suggestion: "Hi! Thanks for picking up. Do you have a quick moment?",
      stage: 'greeting',
      tip: 'Be warm and ask permission to talk',
      callerSentiment: 'neutral',
    });
    lastProcessedRef.current = '';
    
    await startListening();
    
    toast({
      title: 'Call started',
      description: 'Listening to the caller. The AI will suggest what to say.',
    });
  }, [isSupported, startListening, toast]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    stopListening();
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    toast({
      title: 'Call ended',
      description: `${transcript.length} exchanges recorded.`,
    });
  }, [stopListening, transcript.length, toast]);

  const resetCall = useCallback(() => {
    setTranscript([]);
    setCurrentStage('greeting');
    setCurrentSuggestion({
      suggestion: "Hi! Thanks for picking up. Do you have a quick moment?",
      stage: 'greeting',
      tip: 'Be warm and ask permission to talk',
      callerSentiment: 'neutral',
    });
    lastProcessedRef.current = '';
  }, []);

  const markSuggestionUsed = useCallback(() => {
    const newEntry: TranscriptEntry = {
      id: `suggestion-${Date.now()}`,
      role: 'suggestion',
      text: currentSuggestion.suggestion,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, newEntry]);
  }, [currentSuggestion.suggestion]);

  const getStatus = () => {
    if (!isCallActive) return 'idle';
    if (isProcessing) return 'processing';
    if (isListening) return 'listening';
    return 'idle';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gradient">
              Sales Call Assistant
            </h1>
            <ListeningIndicator status={getStatus()} />
          </div>
          
          <div className="flex items-center gap-2">
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
            
            {isCallActive && (
              <Button variant="outline" size="sm" onClick={resetCall}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            
            {!isCallActive ? (
              <Button onClick={startCall} className="gap-2">
                <Phone className="w-4 h-4" />
                Start Call
              </Button>
            ) : (
              <Button onClick={endCall} variant="destructive" className="gap-2">
                <PhoneOff className="w-4 h-4" />
                End Call
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Sales Stage Progress */}
      <div className="border-b border-border px-4 py-2 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <SalesStageIndicator currentStage={currentStage} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Suggestion Panel - Main focus */}
        <div className="flex-1 p-4 lg:p-8 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <SuggestionCard
                suggestion={currentSuggestion.suggestion}
                tip={currentSuggestion.tip}
                sentiment={currentSuggestion.callerSentiment}
                isLoading={isProcessing}
                isActive={isCallActive}
              />
              
              {isCallActive && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markSuggestionUsed}
                    className="text-xs"
                  >
                    I said this ✓
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Goal reminder */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Goal:</span> {settings.goal}
            </p>
          </div>
        </div>

        {/* Transcript Panel - Sidebar */}
        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/30 h-64 lg:h-auto">
          <TranscriptPanel 
            entries={transcript} 
            interimText={isListening ? interimTranscript : undefined}
          />
        </div>
      </div>

      {/* Not Supported Warning */}
      {!isSupported && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl p-6 max-w-md text-center shadow-xl border border-border">
            <h2 className="text-xl font-semibold mb-2">Browser Not Supported</h2>
            <p className="text-muted-foreground mb-4">
              Speech recognition requires Chrome, Edge, or Safari. Please open this app in a supported browser.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
