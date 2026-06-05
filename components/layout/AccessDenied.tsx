'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccessDeniedProps {
  title?: string;
  description?: string;
}

export default function AccessDenied({
  title = 'Access denied',
  description = 'You do not have permission to view this page. Contact your administrator if you believe this is an error.',
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center px-6 py-12">
      <div className="w-14 h-14 rounded-lg bg-pq-neutral-100 border border-pq-neutral-200 flex items-center justify-center mb-4">
        <ShieldOff className="w-7 h-7 text-pq-neutral-500" />
      </div>
      <h1 className="text-xl font-semibold text-pq-neutral-900 mb-2">{title}</h1>
      <p className="text-sm text-pq-neutral-600 leading-relaxed mb-6">{description}</p>
      <Button asChild variant="default">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
