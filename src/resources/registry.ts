import type { McpResource } from '../core/types.js';
import type { ResourceDefinition, ResourceRegistry } from './types.js';

export class DefaultResourceRegistry implements ResourceRegistry {
  private resources = new Map<string, ResourceDefinition>();
  private subscriptions = new Map<string, Set<(resource: any) => void>>();

  register(resource: ResourceDefinition): void {
    this.resources.set(resource.uri, resource);
  }

  unregister(uri: string): void {
    this.resources.delete(uri);
    this.subscriptions.delete(uri);
  }

  list(): McpResource[] {
    return Array.from(this.resources.values()).map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  get(uri: string): ResourceDefinition | undefined {
    return this.resources.get(uri);
  }

  has(uri: string): boolean {
    return this.resources.has(uri);
  }

  clear(): void {
    this.resources.clear();
    this.subscriptions.clear();
  }

  subscribe(uri: string, callback: (resource: any) => void): void {
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, new Set());
    }
    this.subscriptions.get(uri)?.add(callback);
  }

  unsubscribe(uri: string, callback: (resource: any) => void): void {
    const callbacks = this.subscriptions.get(uri);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(uri);
      }
    }
  }

  notifySubscribers(uri: string, resource: any): void {
    const callbacks = this.subscriptions.get(uri);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(resource);
        } catch (error) {
          console.error(`Error in resource subscription callback for ${uri}:`, error);
        }
      }
    }
  }

  size(): number {
    return this.resources.size;
  }

  uris(): string[] {
    return Array.from(this.resources.keys());
  }

  getSubscriptionCount(uri: string): number {
    return this.subscriptions.get(uri)?.size ?? 0;
  }
}
