import type { McpResource, McpResourceContents } from '../core/types.js';

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: () => Promise<McpResourceContents> | McpResourceContents;
  metadata?: Record<string, unknown>;
}

export interface ResourceRegistry {
  register(resource: ResourceDefinition): void;
  unregister(uri: string): void;
  list(): McpResource[];
  get(uri: string): ResourceDefinition | undefined;
  has(uri: string): boolean;
  clear(): void;
  subscribe?(uri: string, callback: (resource: McpResourceContents) => void): void;
  unsubscribe?(uri: string, callback: (resource: McpResourceContents) => void): void;
}

export interface ResourceSubscription {
  uri: string;
  callback: (resource: McpResourceContents) => void;
}

export interface ResourceWatcher {
  watch(uri: string): Promise<void>;
  unwatch(uri: string): Promise<void>;
  isWatching(uri: string): boolean;
  onChange(callback: (uri: string, contents: McpResourceContents) => void): void;
}

export interface ResourceCache {
  get(uri: string): McpResourceContents | undefined;
  set(uri: string, contents: McpResourceContents, ttl?: number): void;
  delete(uri: string): void;
  clear(): void;
  has(uri: string): boolean;
}

export type ResourceUriScheme = 'file' | 'http' | 'https' | 'data' | 'memory' | string;

export interface ResourceOptions {
  cache?: boolean;
  cacheTtl?: number;
  watch?: boolean;
  encoding?: 'utf-8' | 'base64' | 'binary';
}
