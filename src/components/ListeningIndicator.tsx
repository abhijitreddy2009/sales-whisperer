import { cn } from '@/lib/utils';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface ListeningIndicatorProps {
  status: 'idle' | 'listening' | 'processing';
  className?: string;
}

export function ListeningIndicator({ status, className }: ListeningIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300",
        status === 'idle' && "bg-muted",
        status === 'listening' && "bg-primary/20",
        status === 'processing' && "bg-accent/20"
      )}>
        {status === 'idle' && (
          <MicOff className="w-5 h-5 text-muted-foreground" />
        )}
        
        {status === 'listening' && (
          <>
            <Mic className="w-5 h-5 text-primary relative z-10" />
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          </>
        )}
        
        {status === 'processing' && (
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        )}
      </div>

      <div className="flex flex-col">
        <span className={cn(
          "text-sm font-medium transition-colors",
          status === 'idle' && "text-muted-foreground",
          status === 'listening' && "text-primary",
          status === 'processing' && "text-accent"
        )}>
          {status === 'idle' && 'Ready to listen'}
          {status === 'listening' && 'Listening...'}
          {status === 'processing' && 'Thinking...'}
        </span>
        
        {status === 'listening' && (
          <div className="flex items-center gap-0.5 mt-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-primary rounded-full animate-wave"
                style={{
                  height: '12px',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
