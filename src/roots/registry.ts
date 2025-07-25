import type { McpRoot } from '../core/types.js';
import type { RootDefinition, RootRegistry } from './types.js';

export class DefaultRootRegistry implements RootRegistry {
  private roots = new Map<string, RootDefinition>();

  register(root: RootDefinition): void {
    this.roots.set(root.uri, root);
  }

  unregister(uri: string): void {
    this.roots.delete(uri);
  }

  list(): McpRoot[] {
    return Array.from(this.roots.values()).map((root) => ({
      uri: root.uri,
      name: root.name,
    }));
  }

  get(uri: string): RootDefinition | undefined {
    return this.roots.get(uri);
  }

  has(uri: string): boolean {
    return this.roots.has(uri);
  }

  clear(): void {
    this.roots.clear();
  }

  size(): number {
    return this.roots.size;
  }

  uris(): string[] {
    return Array.from(this.roots.keys());
  }
}
