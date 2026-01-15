import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Settings, Target, Sparkles } from 'lucide-react';

interface CallSettings {
  goal: string;
  style: string;
  customStyle: string;
}

interface SettingsPanelProps {
  settings: CallSettings;
  onSettingsChange: (settings: CallSettings) => void;
}

const STYLE_PRESETS = [
  { value: 'warm', label: 'Warm & Friendly', description: 'Conversational, builds rapport' },
  { value: 'professional', label: 'Professional', description: 'Direct, business-focused' },
  { value: 'concise', label: 'Concise', description: 'Short, to the point' },
  { value: 'consultative', label: 'Consultative', description: 'Advisory, solution-focused' },
  { value: 'custom', label: 'Custom', description: 'Define your own style' },
];

const GOAL_TEMPLATES = [
  'Get them interested in learning more',
  'Schedule a demo or meeting',
  'Qualify if they\'re a good fit',
  'Get them to visit the website',
  'Book a follow-up call',
];

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Call Settings
          </SheetTitle>
          <SheetDescription>
            Customize the AI assistant for your call
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Goal */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Call Goal
            </Label>
            <Textarea
              placeholder="What do you want to achieve on this call?"
              value={settings.goal}
              onChange={(e) => onSettingsChange({ ...settings, goal: e.target.value })}
              className="min-h-[80px] resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {GOAL_TEMPLATES.map((template) => (
                <button
                  key={template}
                  onClick={() => onSettingsChange({ ...settings, goal: template })}
                  className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-3">
            <Label>Communication Style</Label>
            <Select
              value={settings.style}
              onValueChange={(value) => onSettingsChange({ ...settings, style: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a style" />
              </SelectTrigger>
              <SelectContent>
                {STYLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    <div className="flex flex-col items-start">
                      <span>{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {settings.style === 'custom' && (
              <Input
                placeholder="e.g., enthusiastic, emphasize speed"
                value={settings.customStyle}
                onChange={(e) => onSettingsChange({ ...settings, customStyle: e.target.value })}
              />
            )}
          </div>

          {/* Tips */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-medium">Quick Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Be specific about your product/service in the goal</li>
              <li>• The AI adapts to the caller's responses</li>
              <li>• You can change settings during the call</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
