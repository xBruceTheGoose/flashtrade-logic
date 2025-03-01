
import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulsing?: boolean;
}

const Badge = ({ 
  children, 
  className, 
  variant = 'default', 
  size = 'md',
  pulsing = false,
  ...props 
}: BadgeProps) => {
  const variantClasses = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        pulsing && 'animate-pulse-subtle',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Badge;
