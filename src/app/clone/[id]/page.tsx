'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ScrapeResult } from '@/types/clone';
import { Header } from '@/components/header';
import { CloneResults } from '@/components/clone-results';
import { Skeleton } from '@/components/ui/skeleton';
import { getCloneResult } from '@/lib/clone-store';

export default function ClonePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    const stored = getCloneResult(id);

    if (stored) {
      setData(stored);
    } else {
      router.push('/');
    }

    setLoading(false);
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 gap-4 p-4">
          <Skeleton className="h-full w-[350px]" />
          <Skeleton className="h-full flex-1" />
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
