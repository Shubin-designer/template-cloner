'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ScrapeResult } from '@/types/clone';
import { Header } from '@/components/header';
import { CloneResults } from '@/components/clone-results';
import { Skeleton } from '@/components/ui/skeleton';
import { getCloneResult } from '@/lib/clone-store';
import { toast } from 'sonner';

export default function ClonePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;

    // First try in-memory store (from fresh scrape)
    const stored = getCloneResult(id);
    if (stored) {
      setData(stored);
      setLoading(false);
      return;
    }

    // Otherwise try to load from Supabase
    async function loadFromDB() {
      try {
        const res = await fetch(`/api/clone/${id}`);
        if (!res.ok) {
          toast.error('Clone not found');
          router.push('/');
          return;
        }
        const clone = await res.json();
        setData({
          id: clone.id,
          url: clone.url,
          html: clone.html,
          screenshot: clone.screenshot,
          tree: clone.tree,
          metadata: clone.metadata,
          createdAt: clone.createdAt,
        });
      } catch {
        toast.error('Failed to load clone');
        router.push('/');
      }
      setLoading(false);
    }

    loadFromDB();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 gap-4 p-4">
          <Skeleton className="h-[80vh] w-[350px]" />
          <Skeleton className="h-[80vh] flex-1" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <CloneResults data={data} />
    </div>
  );
}
