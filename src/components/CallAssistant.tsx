import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { SuggestionCard } from './SuggestionCard';
import { SalesStageIndicator } from './SalesStageIndicator';
import { TranscriptPanel } from './TranscriptPanel';
import { ListeningIndicator } from './ListeningIndicator';
import { SettingsPanel } from './SettingsPanel';
import { Phone, PhoneOff, RotateCcw, Volume2, Send, Keyboard } from 'lucide-react';
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

const OPENING_LINES = [
  "Hi! Thanks for picking up. Do you have a quick moment?",
];

export function CallAssistant() {
  const { toast } = useToast();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState('greeting');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [speechStatus, setSpeechStatus] = useState<string>('');
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<AIResponse>({
    suggestion: OPENING_LINES[0],
    stage: 'greeting',
    tip: 'Say this when they pick up. Be warm and friendly!',
    callerSentiment: 'neutral',
  });
  const [settings, setSettings] = useState<CallSettings>({
    goal: 'Get them interested in learning more',
    style: 'warm',
    customStyle: '',
  });
  const [waitingForCaller, setWaitingForCaller] = useState(false);

  const lastProcessedRef = useRef<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Mic level visualization
  const startMicVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(average / 255);
        }
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (error) {
      console.error('Mic visualization error:', error);
    }
  }, []);

  const stopMicVisualization = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stopMicVisualization();
    };
  }, [stopMicVisualization]);

  const processTranscript = useCallback(async (text: string) => {
    if (text === lastProcessedRef.current || text.length < 2) return;
    lastProcessedRef.current = text;

    setIsProcessing(true);
    setWaitingForCaller(false);

    try {
      const styleText = settings.style === 'custom' ? settings.customStyle : settings.style;
      
      console.log('🚀 Calling AI with:', text);
      
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

      console.log('✅ AI Response:', data);

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
    console.log('🎤 Speech result:', { text, isFinal });
    
    if (isFinal && text.trim().length > 0) {
      const newEntry: TranscriptEntry = {
        id: Date.now().toString(),
        role: 'caller',
        text: text.trim(),
        timestamp: new Date(),
      };
      setTranscript(prev => [...prev, newEntry]);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Faster - only 150ms delay
      debounceRef.current = setTimeout(() => {
        processTranscript(text.trim());
      }, 150);
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

  const handleStatusChange = useCallback((status: string) => {
    setSpeechStatus(status);
  }, []);

  const { isListening, isSupported, interimTranscript, startListening, stopListening } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: handleSpeechError,
    onStatusChange: handleStatusChange,
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
    setWaitingForCaller(true);
    setCurrentSuggestion({
      suggestion: OPENING_LINES[0],
      stage: 'greeting',
      tip: '👆 SAY THIS when they pick up! Then wait for their response.',
      callerSentiment: 'neutral',
    });
    lastProcessedRef.current = '';
    
    await startListening();
    await startMicVisualization();
    
    toast({
      title: '📞 Call started!',
      description: 'Read the script above when they answer. Mic is listening for their response.',
    });
  }, [isSupported, startListening, startMicVisualization, toast]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    setWaitingForCaller(false);
    stopListening();
    stopMicVisualization();
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    toast({
      title: 'Call ended',
      description: `${transcript.length} exchanges recorded.`,
    });
  }, [stopListening, stopMicVisualization, transcript.length, toast]);

  const resetCall = useCallback(() => {
    setTranscript([]);
    setCurrentStage('greeting');
    setWaitingForCaller(true);
    setCurrentSuggestion({
      suggestion: OPENING_LINES[0],
      stage: 'greeting',
      tip: '👆 SAY THIS when they pick up! Then wait for their response.',
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
    setWaitingForCaller(true);
    
    toast({
      title: '✓ Got it!',
      description: 'Now waiting for their response...',
    });
  }, [currentSuggestion.suggestion, toast]);

  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    
    const text = manualInput.trim();
    setManualInput('');
    
    const newEntry: TranscriptEntry = {
      id: Date.now().toString(),
      role: 'caller',
      text,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, newEntry]);
    processTranscript(text);
  }, [manualInput, processTranscript]);

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
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowManualInput(!showManualInput)}
                  title="Type what caller said"
                >
                  <Keyboard className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetCall}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </>
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
          {/* Mic Level & Status when active */}
          {isCallActive && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-card border border-border">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 max-w-xs h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-75 rounded-full"
                    style={{ width: `${Math.max(micLevel * 100, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[120px]">
                  {micLevel > 0.15 ? '🎤 Hearing audio!' : micLevel > 0.05 ? '🔈 Some sound...' : '🔇 Quiet...'}
                </span>
              </div>
              
              {/* Speech status */}
              {speechStatus && (
                <div className="text-center text-xs text-muted-foreground">
                  Status: {speechStatus} | {interimTranscript && <span className="text-primary">"{interimTranscript}"</span>}
                </div>
              )}

              {/* Manual input option */}
              {showManualInput && (
                <div className="flex gap-2 max-w-xl mx-auto">
                  <Input
                    placeholder="Type what the caller said..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    className="flex-1"
                  />
                  <Button onClick={handleManualSubmit} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <SuggestionCard
                suggestion={currentSuggestion.suggestion}
                tip={currentSuggestion.tip}
                sentiment={currentSuggestion.callerSentiment}
                isLoading={isProcessing}
                isActive={isCallActive || true}
              />
              
              {isCallActive && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={markSuggestionUsed}
                    className="gap-2"
                  >
                    ✓ I said this - waiting for their reply
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Mic not working? Click <Keyboard className="w-3 h-3 inline" /> to type what caller says
                  </p>
                </div>
              )}

              {!isCallActive && (
                <div className="mt-6 text-center space-y-3">
                  <p className="text-muted-foreground">
                    👆 This is what you'll say when they pick up
                  </p>
                  <Button onClick={startCall} size="lg" className="gap-2">
                    <Phone className="w-5 h-5" />
                    Start Call & Listen
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Works best in Chrome/Edge with phone on speaker near mic
                  </p>
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
