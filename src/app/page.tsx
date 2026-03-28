import { Header } from '@/components/header';
import { UrlInput } from '@/components/url-input';
import { Globe } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Globe className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SiteCloner</h1>
          <p className="max-w-md text-muted-foreground">
            Paste any URL to extract its structure, styles, and assets.
            Export to Figma or generate code.
          </p>
        </div>
        <UrlInput />
        <p className="text-xs text-muted-foreground">
          Works with any public website. Scraping may take up to 30 seconds.
        </p>
      </main>
    </div>
  );
}
