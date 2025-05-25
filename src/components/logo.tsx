import { BrainCircuit } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

interface LogoProps {
  iconOnly?: boolean;
  className?: string;
}

export function Logo({ iconOnly = false, className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrainCircuit className="h-7 w-7 text-primary" />
      {!iconOnly && (
        <span className="text-xl font-semibold text-foreground whitespace-nowrap">
          {APP_NAME.split(':')[0]} {/* Show only "Mahasen AI" part for brevity */}
        </span>
      )}
    </div>
  );
}
