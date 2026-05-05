import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingState({ message, className, size = 'md' }: LoadingStateProps) {
  const spinnerSize = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('border-2 border-[#D8E2FF] border-t-[#1E4BFF] rounded-full animate-spin', spinnerSize)} />
      {message && (
        <p className="text-sm text-[#40527A]">{message}</p>
      )}
    </div>
  );
}
