import { Clock, Printer, CheckCircle2, CheckCheck, XCircle } from 'lucide-react';
import { OrderStatus } from '../types/print';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', showIcon = true, className = '' }: StatusBadgeProps) {
  const configs: Record<
    OrderStatus,
    { label: string; icon: typeof Clock; bg: string; text: string; border: string; dot: string }
  > = {
    waiting: {
      label: 'Waiting in Queue',
      icon: Clock,
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    },
    printing: {
      label: 'Printing in Progress',
      icon: Printer,
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      dot: 'bg-blue-600',
    },
    ready: {
      label: 'Ready for Pickup',
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      dot: 'bg-emerald-600',
    },
    completed: {
      label: 'Completed / Claimed',
      icon: CheckCheck,
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200',
      dot: 'bg-gray-600',
    },
    cancelled: {
      label: 'Cancelled',
      icon: XCircle,
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
    },
  };

  const config = configs[status] || configs.waiting;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <Icon
          className={`${iconSizes} ${status === 'printing' ? 'animate-pulse' : ''}`}
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}
