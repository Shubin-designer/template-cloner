import type { ComponentNode } from './component-tree';

export interface ScrapeResult {
  id: string;
  url: string;
  html: string;
  screenshot: string; // base64 PNG
  tree: ComponentNode[];
  metadata: PageMetadata;
  figmaData?: unknown; // Raw html-to-figma output for direct Figma export
  createdAt: string;
}

export interface PageMetadata {
  title: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  fonts: string[];
  cssUrls: string[];
  imageUrls: string[];
}

export interface CloneListItem {
  id: string;
  url: string;
  screenshot: string;
  title: string;
  createdAt: string;
}
