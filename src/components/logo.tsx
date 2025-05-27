import { BrainCircuit } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface LogoProps {
  iconOnly?: boolean;
  className?: string;
}

export function Logo({ iconOnly = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrainCircuit className="h-7 w-7 text-primary glow-icon smooth-transition" />
      {!iconOnly && (
        <span className="editorial-text text-xl font-light text-foreground whitespace-nowrap tracking-ultra-tight">
          {APP_NAME.split(':')[0]} {/* Show only "Mahasen AI" part for brevity */}
        </span>
      )}
    </div>
  );
}
