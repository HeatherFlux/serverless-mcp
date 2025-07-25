import type { McpRoot } from '../core/types.js';

export interface RootDefinition {
  uri: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface RootRegistry {
  register(root: RootDefinition): void;
  unregister(uri: string): void;
  list(): McpRoot[];
  get(uri: string): RootDefinition | undefined;
  has(uri: string): boolean;
  clear(): void;
}

export interface RootOptions {
  recursive?: boolean;
  allowSymlinks?: boolean;
  includeHidden?: boolean;
  filters?: {
    include?: string[];
    exclude?: string[];
  };
}
