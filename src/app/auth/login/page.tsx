'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/header';
import { Globe, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (error) {
      toast.error('Failed to send login link', { description: error.message });
      return;
    }

    setSent(true);
    toast.success('Check your email!', { description: 'We sent you a magic link.' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Sign in to SiteCloner</CardTitle>
            <CardDescription>
              Sign in to save your clones and access history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Mail className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <strong>{email}</strong>.
                  <br />
                  Check your email and click the link to sign in.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSent(false)}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
                <Button type="submit" disabled={isLoading || !email.trim()}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span className="ml-2">Send Magic Link</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
