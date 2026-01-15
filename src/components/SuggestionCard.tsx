import { cn } from '@/lib/utils';
import { MessageSquare, Lightbulb, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SuggestionCardProps {
  suggestion: string;
  tip?: string;
  sentiment?: 'positive' | 'neutral' | 'hesitant' | 'negative';
  isLoading?: boolean;
  isActive?: boolean;
  className?: string;
}

const sentimentConfig = {
  positive: { 
    icon: TrendingUp, 
    label: 'Positive', 
    color: 'text-primary',
    bg: 'bg-primary/10'
  },
  neutral: { 
    icon: Minus, 
    label: 'Neutral', 
    color: 'text-muted-foreground',
    bg: 'bg-muted'
  },
  hesitant: { 
    icon: TrendingDown, 
    label: 'Hesitant', 
    color: 'text-accent',
    bg: 'bg-accent/10'
  },
  negative: { 
    icon: TrendingDown, 
    label: 'Resistant', 
    color: 'text-destructive',
    bg: 'bg-destructive/10'
  },
};

export function SuggestionCard({
  suggestion,
  tip,
  sentiment = 'neutral',
  isLoading,
  isActive,
  className,
}: SuggestionCardProps) {
  // Ensure sentiment is valid, fallback to neutral
  const validSentiment = sentiment && sentimentConfig[sentiment] ? sentiment : 'neutral';
  const SentimentIcon = sentimentConfig[validSentiment].icon;

  return (
    <div
      className={cn(
        "suggestion-card transition-all duration-300",
        isActive && "active glow-ring",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            isActive ? "bg-primary/20" : "bg-muted"
          )}>
            <MessageSquare className={cn(
              "w-4 h-4",
              isActive ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            Say this
          </span>
        </div>

        {/* Sentiment indicator */}
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
          sentimentConfig[validSentiment].bg,
          sentimentConfig[validSentiment].color
        )}>
          <SentimentIcon className="w-3 h-3" />
          <span>{sentimentConfig[validSentiment].label}</span>
        </div>
      </div>

      {/* Main suggestion */}
      <div className="relative">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-6 bg-muted rounded w-1/2" />
          </div>
        ) : (
          <p className={cn(
            "text-xl md:text-2xl font-medium leading-relaxed transition-all duration-300",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}>
            "{suggestion}"
          </p>
        )}
      </div>

      {/* Tip */}
      {tip && !isLoading && (
        <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border/50">
          <Lightbulb className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            {tip}
          </p>
        </div>
      )}
    </div>
  );
}
