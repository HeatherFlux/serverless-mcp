import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryResourceCache } from './cache.js';

describe('MemoryResourceCache', () => {
  let cache: MemoryResourceCache;

  beforeEach(() => {
    cache = new MemoryResourceCache(1000); // 1 second TTL
  });

  describe('basic operations', () => {
    it('should store and retrieve resources', () => {
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      cache.set('test://example.txt', resource);
      const retrieved = cache.get('test://example.txt');

      expect(retrieved).toEqual(resource);
    });

    it('should return undefined for non-existent resources', () => {
      const retrieved = cache.get('test://nonexistent.txt');
      expect(retrieved).toBeUndefined();
    });

    it('should check if resources exist', () => {
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      expect(cache.has('test://example.txt')).toBe(false);
      cache.set('test://example.txt', resource);
      expect(cache.has('test://example.txt')).toBe(true);
    });

    it('should delete resources', () => {
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      cache.set('test://example.txt', resource);
      expect(cache.has('test://example.txt')).toBe(true);

      cache.delete('test://example.txt');
      expect(cache.has('test://example.txt')).toBe(false);
      expect(cache.get('test://example.txt')).toBeUndefined();
    });

    it('should clear all resources', () => {
      const resource1 = {
        uri: 'test://example1.txt',
        mimeType: 'text/plain',
        text: 'Hello World 1',
      };
      const resource2 = {
        uri: 'test://example2.txt',
        mimeType: 'text/plain',
        text: 'Hello World 2',
      };

      cache.set('test://example1.txt', resource1);
      cache.set('test://example2.txt', resource2);
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.has('test://example1.txt')).toBe(false);
      expect(cache.has('test://example2.txt')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL', async () => {
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      // Set with 100ms TTL
      cache.set('test://example.txt', resource, 100);
      expect(cache.get('test://example.txt')).toEqual(resource);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('test://example.txt')).toBeUndefined();
      expect(cache.has('test://example.txt')).toBe(false);
    });

    it('should use default TTL when not specified', async () => {
      const shortTtlCache = new MemoryResourceCache(100); // 100ms default
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      shortTtlCache.set('test://example.txt', resource);
      expect(shortTtlCache.get('test://example.txt')).toEqual(resource);

      // Wait for default TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortTtlCache.get('test://example.txt')).toBeUndefined();
    });

    it('should not expire when TTL is 0 or negative', () => {
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      cache.set('test://example.txt', resource, 0);
      expect(cache.get('test://example.txt')).toEqual(resource);

      cache.set('test://example2.txt', resource, -1);
      expect(cache.get('test://example2.txt')).toEqual(resource);
    });

    it('should handle cache without default TTL', () => {
      const noTtlCache = new MemoryResourceCache(0);
      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      noTtlCache.set('test://example.txt', resource);
      expect(noTtlCache.get('test://example.txt')).toEqual(resource);
    });
  });

  describe('cleanup functionality', () => {
    it('should clean up expired entries', async () => {
      const resource1 = {
        uri: 'test://example1.txt',
        mimeType: 'text/plain',
        text: 'Hello World 1',
      };
      const resource2 = {
        uri: 'test://example2.txt',
        mimeType: 'text/plain',
        text: 'Hello World 2',
      };

      // Set one with short TTL, one with no TTL
      cache.set('test://example1.txt', resource1, 100);
      cache.set('test://example2.txt', resource2, 0);

      expect(cache.size()).toBe(2);

      // Wait for first to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Manual cleanup
      cache.cleanup();

      expect(cache.size()).toBe(1);
      expect(cache.has('test://example1.txt')).toBe(false);
      expect(cache.has('test://example2.txt')).toBe(true);
    });

    it('should not affect non-expired entries during cleanup', () => {
      const resource1 = {
        uri: 'test://example1.txt',
        mimeType: 'text/plain',
        text: 'Hello World 1',
      };
      const resource2 = {
        uri: 'test://example2.txt',
        mimeType: 'text/plain',
        text: 'Hello World 2',
      };

      // Set both with long TTL
      cache.set('test://example1.txt', resource1, 10000);
      cache.set('test://example2.txt', resource2, 10000);

      expect(cache.size()).toBe(2);

      cache.cleanup();

      expect(cache.size()).toBe(2);
      expect(cache.has('test://example1.txt')).toBe(true);
      expect(cache.has('test://example2.txt')).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should allow changing default TTL', () => {
      cache.setDefaultTtl(5000);

      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      cache.set('test://example.txt', resource);

      // The resource should still be valid after the original default TTL
      // but we can't easily test the new TTL without waiting
      expect(cache.get('test://example.txt')).toEqual(resource);
    });

    it('should return correct size', () => {
      expect(cache.size()).toBe(0);

      const resource = {
        uri: 'test://example.txt',
        mimeType: 'text/plain',
        text: 'Hello World',
      };

      cache.set('test://example1.txt', resource);
      expect(cache.size()).toBe(1);

      cache.set('test://example2.txt', resource);
      expect(cache.size()).toBe(2);

      cache.delete('test://example1.txt');
      expect(cache.size()).toBe(1);
    });
  });
});
