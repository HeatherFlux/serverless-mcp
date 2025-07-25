import type { ResourceProvider } from '../core/server.js';
import type { McpResource, McpResourceContents } from '../core/types.js';
import { ResourceNotFoundError, InvalidParamsError } from '../core/errors.js';
import type {
  ResourceRegistry,
  ResourceDefinition,
  ResourceCache,
  ResourceOptions,
} from './types.js';
import { DefaultResourceRegistry } from './registry.js';
import { MemoryResourceCache } from './cache.js';

export class McpResourceProvider implements ResourceProvider {
  private registry: ResourceRegistry;
  private cache?: ResourceCache;
  private subscriptions = new Map<string, Set<() => void>>();

  constructor(registry?: ResourceRegistry, cache?: ResourceCache) {
    this.registry = registry ?? new DefaultResourceRegistry();
    this.cache = cache;
  }

  async listResources(): Promise<McpResource[]> {
    return this.registry.list();
  }

  async readResource(uri: string): Promise<McpResourceContents> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(uri);
      if (cached) {
        return cached;
      }
    }

    // Get resource definition
    const resource = this.registry.get(uri);
    if (!resource) {
      throw new ResourceNotFoundError(uri);
    }

    try {
      const contents = await resource.handler();

      // Ensure URI matches
      if (contents.uri !== uri) {
        contents.uri = uri;
      }

      // Cache the result
      if (this.cache) {
        this.cache.set(uri, contents);
      }

      return contents;
    } catch (error) {
      throw new InvalidParamsError(
        `Error reading resource ${uri}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async subscribeToResource(uri: string): Promise<void> {
    if (!this.registry.has(uri)) {
      throw new ResourceNotFoundError(uri);
    }

    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, new Set());
    }

    // In a real implementation, you might set up file watchers, HTTP polling, etc.
    // For now, we just track the subscription
  }

  async unsubscribeFromResource(uri: string): Promise<void> {
    this.subscriptions.delete(uri);
  }

  registerResource(resource: ResourceDefinition, options: ResourceOptions = {}): void {
    this.validateResourceUri(resource.uri);
    this.registry.register(resource);

    // Set up caching if requested
    if (options.cache && !this.cache) {
      this.cache = new MemoryResourceCache(options.cacheTtl);
    }
  }

  unregisterResource(uri: string): void {
    this.registry.unregister(uri);
    this.subscriptions.delete(uri);
    this.cache?.delete(uri);
  }

  hasResource(uri: string): boolean {
    return this.registry.has(uri);
  }

  clear(): void {
    this.registry.clear();
    this.subscriptions.clear();
    this.cache?.clear();
  }

  // Notify subscribers of resource changes
  async notifyResourceChanged(uri: string): Promise<void> {
    const callbacks = this.subscriptions.get(uri);
    if (callbacks) {
      // Invalidate cache
      this.cache?.delete(uri);

      // Notify all subscribers
      for (const callback of callbacks) {
        try {
          callback();
        } catch (error) {
          console.error(`Error in resource change callback for ${uri}:`, error);
        }
      }
    }
  }

  private validateResourceUri(uri: string): void {
    if (!uri || typeof uri !== 'string') {
      throw new InvalidParamsError('Resource URI must be a non-empty string');
    }

    try {
      new URL(uri);
    } catch {
      throw new InvalidParamsError(`Invalid resource URI format: ${uri}`);
    }
  }

  // Utility methods for creating common resource patterns
  static createStaticResource(
    uri: string,
    name: string,
    content: string,
    mimeType = 'text/plain',
    description?: string,
  ): ResourceDefinition {
    return {
      uri,
      name,
      description,
      mimeType,
      handler: () => ({
        uri,
        mimeType,
        text: content,
      }),
    };
  }

  static createBinaryResource(
    uri: string,
    name: string,
    data: string, // Base64 encoded
    mimeType: string,
    description?: string,
  ): ResourceDefinition {
    return {
      uri,
      name,
      description,
      mimeType,
      handler: () => ({
        uri,
        mimeType,
        blob: data,
      }),
    };
  }

  static createDynamicResource(
    uri: string,
    name: string,
    handler: () => Promise<string> | string,
    mimeType = 'text/plain',
    description?: string,
  ): ResourceDefinition {
    return {
      uri,
      name,
      description,
      mimeType,
      handler: async () => {
        const content = await handler();
        return {
          uri,
          mimeType,
          text: content,
        };
      },
    };
  }
}
