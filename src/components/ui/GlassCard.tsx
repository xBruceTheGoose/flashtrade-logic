
import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  highlighted?: boolean;
}

const GlassCard = ({ 
  children, 
  className, 
  interactive = false, 
  highlighted = false,
  ...props 
}: GlassCardProps) => {
  return (
    <div
      className={cn(
        'rounded-lg p-6 glass-effect border border-white/20 shadow-glass',
        'transition-all duration-300 ease-in-out animate-fade-in',
        interactive && 'hover:shadow-glass-hover hover:translate-y-[-2px] cursor-pointer',
        highlighted && 'ring-2 ring-primary/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
