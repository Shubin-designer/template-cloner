'use client';

import { Globe } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Globe className="h-5 w-5" />
          <span>SiteCloner</span>
        </Link>
      </div>
    </header>
  );
}
