import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidParamsError, ResourceNotFoundError } from '../core/errors.js';
import { MemoryResourceCache } from './cache.js';
import { McpResourceProvider } from './provider.js';
import { DefaultResourceRegistry } from './registry.js';
import type { ResourceDefinition } from './types.js';

describe('McpResourceProvider', () => {
  let provider: McpResourceProvider;

  beforeEach(() => {
    provider = new McpResourceProvider();
  });

  describe('resource registration and listing', () => {
    it('should register and list resources', async () => {
      const resourceDef: ResourceDefinition = {
        uri: 'test://example.txt',
        name: 'Example File',
        description: 'A test resource',
        mimeType: 'text/plain',
        handler: () => ({
          uri: 'test://example.txt',
          mimeType: 'text/plain',
          text: 'Hello World',
        }),
      };

      provider.registerResource(resourceDef);

      const resources = await provider.listResources();
      expect(resources).toHaveLength(1);
      expect(resources[0]).toMatchObject({
        uri: 'test://example.txt',
        name: 'Example File',
        description: 'A test resource',
        mimeType: 'text/plain',
      });
    });

    it('should reject invalid URIs', () => {
      const invalidResource: ResourceDefinition = {
        uri: 'invalid-uri',
        name: 'Invalid',
        handler: () => ({ uri: 'invalid-uri', text: 'test' }),
      };

      expect(() => provider.registerResource(invalidResource)).toThrow(InvalidParamsError);
    });
  });

  describe('resource reading', () => {
    beforeEach(() => {
      const staticResource: ResourceDefinition = {
        uri: 'memory://static.txt',
        name: 'Static Content',
        handler: () => ({
          uri: 'memory://static.txt',
          mimeType: 'text/plain',
          text: 'Static content',
        }),
      };

      const dynamicResource: ResourceDefinition = {
        uri: 'memory://dynamic.txt',
        name: 'Dynamic Content',
        handler: async () => ({
          uri: 'memory://dynamic.txt',
          mimeType: 'text/plain',
          text: `Current time: ${new Date().toISOString()}`,
        }),
      };

      provider.registerResource(staticResource);
      provider.registerResource(dynamicResource);
    });

    it('should read static resources', async () => {
      const contents = await provider.readResource('memory://static.txt');

      expect(contents).toMatchObject({
        uri: 'memory://static.txt',
        mimeType: 'text/plain',
        text: 'Static content',
      });
    });

    it('should read dynamic resources', async () => {
      const contents = await provider.readResource('memory://dynamic.txt');

      expect(contents.uri).toBe('memory://dynamic.txt');
      expect(contents.mimeType).toBe('text/plain');
      expect(contents.text).toMatch(/Current time: \d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error for non-existent resources', async () => {
      await expect(provider.readResource('memory://nonexistent.txt')).rejects.toThrow(
        ResourceNotFoundError,
      );
    });

    it('should handle resource handler errors', async () => {
      const errorResource: ResourceDefinition = {
        uri: 'memory://error.txt',
        name: 'Error Resource',
        handler: () => {
          throw new Error('Handler error');
        },
      };

      provider.registerResource(errorResource);

      await expect(provider.readResource('memory://error.txt')).rejects.toThrow(InvalidParamsError);
    });
  });

  describe('caching', () => {
    let cache: MemoryResourceCache;

    beforeEach(() => {
      cache = new MemoryResourceCache(1000); // 1 second TTL
      provider = new McpResourceProvider(undefined, cache);

      const cachedResource: ResourceDefinition = {
        uri: 'memory://cached.txt',
        name: 'Cached Resource',
        handler: () => ({
          uri: 'memory://cached.txt',
          mimeType: 'text/plain',
          text: `Generated at: ${Date.now()}`,
        }),
      };

      provider.registerResource(cachedResource);
    });

    it('should cache resource contents', async () => {
      const first = await provider.readResource('memory://cached.txt');
      const second = await provider.readResource('memory://cached.txt');

      // Should be the same due to caching
      expect(first.text).toBe(second.text);
    });

    it('should respect cache TTL', async () => {
      const first = await provider.readResource('memory://cached.txt');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const second = await provider.readResource('memory://cached.txt');

      // Should be different due to cache expiry
      expect(first.text).not.toBe(second.text);
    });
  });

  describe('subscriptions', () => {
    beforeEach(() => {
      const watchedResource: ResourceDefinition = {
        uri: 'memory://watched.txt',
        name: 'Watched Resource',
        handler: () => ({
          uri: 'memory://watched.txt',
          mimeType: 'text/plain',
          text: 'Watched content',
        }),
      };

      provider.registerResource(watchedResource);
    });

    it('should handle resource subscriptions', async () => {
      await expect(provider.subscribeToResource('memory://watched.txt')).resolves.not.toThrow();
    });

    it('should handle resource unsubscriptions', async () => {
      await provider.subscribeToResource('memory://watched.txt');
      await expect(provider.unsubscribeFromResource('memory://watched.txt')).resolves.not.toThrow();
    });

    it('should throw error when subscribing to non-existent resource', async () => {
      await expect(provider.subscribeToResource('memory://nonexistent.txt')).rejects.toThrow(
        ResourceNotFoundError,
      );
    });
  });

  describe('resource management', () => {
    it('should check if resources exist', () => {
      const resource: ResourceDefinition = {
        uri: 'memory://test.txt',
        name: 'Test',
        handler: () => ({ uri: 'memory://test.txt', text: 'test' }),
      };

      expect(provider.hasResource('memory://test.txt')).toBe(false);
      provider.registerResource(resource);
      expect(provider.hasResource('memory://test.txt')).toBe(true);
    });

    it('should unregister resources', async () => {
      const resource: ResourceDefinition = {
        uri: 'memory://test.txt',
        name: 'Test',
        handler: () => ({ uri: 'memory://test.txt', text: 'test' }),
      };

      provider.registerResource(resource);
      expect(provider.hasResource('memory://test.txt')).toBe(true);

      provider.unregisterResource('memory://test.txt');
      expect(provider.hasResource('memory://test.txt')).toBe(false);

      const resources = await provider.listResources();
      expect(resources).toHaveLength(0);
    });

    it('should clear all resources', async () => {
      const resource1: ResourceDefinition = {
        uri: 'memory://test1.txt',
        name: 'Test 1',
        handler: () => ({ uri: 'memory://test1.txt', text: 'test1' }),
      };
      const resource2: ResourceDefinition = {
        uri: 'memory://test2.txt',
        name: 'Test 2',
        handler: () => ({ uri: 'memory://test2.txt', text: 'test2' }),
      };

      provider.registerResource(resource1);
      provider.registerResource(resource2);

      let resources = await provider.listResources();
      expect(resources).toHaveLength(2);

      provider.clear();

      resources = await provider.listResources();
      expect(resources).toHaveLength(0);
    });
  });

  describe('static factory methods', () => {
    it('should create static text resources', () => {
      const resource = McpResourceProvider.createStaticResource(
        'memory://static.txt',
        'Static File',
        'Hello World',
        'text/plain',
        'A static text resource',
      );

      expect(resource.uri).toBe('memory://static.txt');
      expect(resource.name).toBe('Static File');
      expect(resource.description).toBe('A static text resource');
      expect(resource.mimeType).toBe('text/plain');

      const contents = resource.handler();
      expect(contents).toMatchObject({
        uri: 'memory://static.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      });
    });

    it('should create binary resources', () => {
      const base64Data = Buffer.from('Hello World').toString('base64');
      const resource = McpResourceProvider.createBinaryResource(
        'memory://binary.dat',
        'Binary File',
        base64Data,
        'application/octet-stream',
        'A binary resource',
      );

      const contents = resource.handler();
      expect(contents).toMatchObject({
        uri: 'memory://binary.dat',
        mimeType: 'application/octet-stream',
        blob: base64Data,
      });
    });

    it('should create dynamic resources', async () => {
      let counter = 0;
      const resource = McpResourceProvider.createDynamicResource(
        'memory://dynamic.txt',
        'Dynamic Counter',
        () => `Count: ${++counter}`,
        'text/plain',
        'A dynamic counter resource',
      );

      const contents1 = await resource.handler();
      const contents2 = await resource.handler();

      expect(contents1.text).toBe('Count: 1');
      expect(contents2.text).toBe('Count: 2');
    });
  });
});
