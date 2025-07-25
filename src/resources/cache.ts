import type { McpResourceContents } from '../core/types.js';
import type { ResourceCache } from './types.js';

interface CacheEntry {
  contents: McpResourceContents;
  expires?: number;
}

export class MemoryResourceCache implements ResourceCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(defaultTtl = 300000) {
    // 5 minutes default
    this.defaultTtl = defaultTtl;
  }

  get(uri: string): McpResourceContents | undefined {
    const entry = this.cache.get(uri);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(uri);
      return undefined;
    }

    return entry.contents;
  }

  set(uri: string, contents: McpResourceContents, ttl?: number): void {
    const entry: CacheEntry = {
      contents,
    };

    if (ttl !== undefined && ttl > 0) {
      entry.expires = Date.now() + ttl;
    } else if (this.defaultTtl > 0) {
      entry.expires = Date.now() + this.defaultTtl;
    }

    this.cache.set(uri, entry);
  }

  delete(uri: string): void {
    this.cache.delete(uri);
  }

  clear(): void {
    this.cache.clear();
  }

  has(uri: string): boolean {
    const entry = this.cache.get(uri);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(uri);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [uri, entry] of this.cache.entries()) {
      if (entry.expires && now > entry.expires) {
        this.cache.delete(uri);
      }
    }
  }

  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }
}
