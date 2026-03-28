'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function AuthButton() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{user.email}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="ml-1.5 hidden sm:inline">Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => router.push('/auth/login')}>
      <LogIn className="h-3.5 w-3.5" />
      <span className="ml-1.5">Sign in</span>
    </Button>
  );
}
