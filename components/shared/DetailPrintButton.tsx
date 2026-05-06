import React from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DetailPrintButton({
  href,
  label = 'Print',
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} target="_blank" className={cn(className)}>
      <Printer className="w-4 h-4" />
      {label}
    </Link>
  );
}

