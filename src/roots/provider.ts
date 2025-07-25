import { InvalidParamsError } from '../core/errors.js';
import type { RootProvider } from '../core/server.js';
import type { McpRoot } from '../core/types.js';
import { DefaultRootRegistry } from './registry.js';
import type { RootDefinition, RootOptions, RootRegistry } from './types.js';

export class McpRootProvider implements RootProvider {
  private registry: RootRegistry;

  constructor(registry?: RootRegistry) {
    this.registry = registry ?? new DefaultRootRegistry();
  }

  async listRoots(): Promise<McpRoot[]> {
    return this.registry.list();
  }

  registerRoot(root: RootDefinition, options: RootOptions = {}): void {
    this.validateRootUri(root.uri);

    const enhancedRoot: RootDefinition = {
      ...root,
      metadata: {
        ...root.metadata,
        ...options,
      },
    };

    this.registry.register(enhancedRoot);
  }

  unregisterRoot(uri: string): void {
    this.registry.unregister(uri);
  }

  hasRoot(uri: string): boolean {
    return this.registry.has(uri);
  }

  clear(): void {
    this.registry.clear();
  }

  private validateRootUri(uri: string): void {
    if (!uri || typeof uri !== 'string') {
      throw new InvalidParamsError('Root URI must be a non-empty string');
    }

    try {
      new URL(uri);
    } catch {
      throw new InvalidParamsError(`Invalid root URI format: ${uri}`);
    }
  }

  // Utility methods for creating common root patterns
  static createFileRoot(path: string, name?: string, options?: RootOptions): RootDefinition {
    return {
      uri: `file://${path}`,
      name: name ?? path,
      metadata: options as Record<string, unknown>,
    };
  }

  static createHttpRoot(url: string, name?: string, options?: RootOptions): RootDefinition {
    return {
      uri: url,
      name: name ?? new URL(url).hostname,
      metadata: options as Record<string, unknown>,
    };
  }

  static createMemoryRoot(
    identifier: string,
    name?: string,
    options?: RootOptions,
  ): RootDefinition {
    return {
      uri: `memory://${identifier}`,
      name: name ?? identifier,
      metadata: options as Record<string, unknown>,
    };
  }
}
