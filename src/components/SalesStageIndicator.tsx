import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGES = [
  { id: 'greeting', label: 'Greet', icon: '👋' },
  { id: 'rapport', label: 'Rapport', icon: '🤝' },
  { id: 'discovery', label: 'Discover', icon: '🔍' },
  { id: 'value', label: 'Value', icon: '💎' },
  { id: 'objection', label: 'Handle', icon: '🛡️' },
  { id: 'next_step', label: 'Next Step', icon: '📅' },
  { id: 'close', label: 'Close', icon: '🎯' },
];

interface SalesStageIndicatorProps {
  currentStage: string;
  className?: string;
}

export function SalesStageIndicator({ currentStage, className }: SalesStageIndicatorProps) {
  const currentIndex = STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
      {STAGES.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = stage.id === currentStage;
        const isUpcoming = index > currentIndex;

        return (
          <div
            key={stage.id}
            className={cn(
              "stage-indicator flex-shrink-0 transition-all duration-300",
              isCompleted && "completed",
              isCurrent && "active",
              isUpcoming && "upcoming"
            )}
          >
            <span className="text-sm">{stage.icon}</span>
            <span className="hidden sm:inline">{stage.label}</span>
            {isCompleted && <Check className="w-3 h-3 ml-1" />}
          </div>
        );
      })}
    </div>
  );
}
