'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, ExternalLink, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CloneItem {
  id: string;
  url: string;
  title: string;
  screenshotUrl: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [clones, setClones] = useState<CloneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchClones();
  }, []);

  async function fetchClones() {
    try {
      const res = await fetch('/api/clone');
      if (res.status === 401) {
        setError('Sign in to see your clone history.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load history');
      } else {
        setClones(data.clones);
      }
    } catch {
      setError('Failed to connect to server');
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/clone/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setClones((prev) => prev.filter((c) => c.id !== id));
      toast.success('Clone deleted');
    } else {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Clone History</h1>
          </div>

          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">{error}</p>
              {error.includes('Sign in') && (
                <Button onClick={() => router.push('/auth/login')}>
                  Sign in
                </Button>
              )}
            </div>
          )}

          {!loading && !error && clones.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">No clones yet.</p>
              <Button onClick={() => router.push('/')}>Clone a website</Button>
            </div>
          )}

          {!loading && !error && clones.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clones.map((clone) => (
                <Card
                  key={clone.id}
                  className="group cursor-pointer overflow-hidden transition-colors hover:border-primary/50"
                  onClick={() => router.push(`/clone/${clone.id}`)}
                >
                  <div className="aspect-video overflow-hidden bg-muted">
                    {clone.screenshotUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={clone.screenshotUrl}
                        alt={clone.title}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No preview
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {clone.title || 'Untitled'}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {clone.url}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(clone.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(clone.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
