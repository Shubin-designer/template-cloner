'use client';

import { Globe, History } from 'lucide-react';
import Link from 'next/link';
import { AuthButton } from './auth-button';

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Globe className="h-5 w-5" />
            <span>SiteCloner</span>
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </Link>
        </div>
        <AuthButton />
      </div>
    </header>
  );
}
