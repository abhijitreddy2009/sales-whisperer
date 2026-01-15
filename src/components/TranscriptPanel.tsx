import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, User } from 'lucide-react';

interface TranscriptEntry {
  id: string;
  role: 'caller' | 'suggestion';
  text: string;
  timestamp: Date;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  interimText?: string;
  className?: string;
}

export function TranscriptPanel({ entries, interimText, className }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, interimText]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Phone className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Call Transcript</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {entries.length} exchanges
        </span>
      </div>

      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4 space-y-3">
          {entries.length === 0 && !interimText && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>Start the call to see the transcript</p>
              <p className="text-xs mt-1 opacity-70">
                The caller's speech will appear here
              </p>
            </div>
          )}

          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex gap-2 animate-fade-in",
                entry.role === 'suggestion' ? "justify-end" : "justify-start"
              )}
            >
              {entry.role === 'caller' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                  <Phone className="w-3 h-3 text-caller" />
                </div>
              )}
              
              <div className={cn(
                "transcript-bubble",
                entry.role === 'caller' ? "caller" : "suggestion"
              )}>
                <p className="text-sm">{entry.text}</p>
                <span className="text-[10px] opacity-50 mt-1 block">
                  {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {entry.role === 'suggestion' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-3 h-3 text-primary" />
                </div>
              )}
            </div>
          ))}

          {/* Interim text (what's being spoken right now) */}
          {interimText && (
            <div className="flex gap-2 justify-start animate-pulse">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                <Phone className="w-3 h-3 text-caller" />
              </div>
              <div className="transcript-bubble caller opacity-70">
                <p className="text-sm italic">{interimText}...</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
