import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidParamsError } from '../core/errors.js';
import { McpRootProvider } from './provider.js';
import type { RootDefinition } from './types.js';

describe('McpRootProvider', () => {
  let provider: McpRootProvider;

  beforeEach(() => {
    provider = new McpRootProvider();
  });

  describe('root registration and listing', () => {
    it('should register and list roots', async () => {
      const rootDef: RootDefinition = {
        uri: 'file:///home/user/project',
        name: 'Project Root',
      };

      provider.registerRoot(rootDef);

      const roots = await provider.listRoots();
      expect(roots).toHaveLength(1);
      expect(roots[0]).toMatchObject({
        uri: 'file:///home/user/project',
        name: 'Project Root',
      });
    });

    it('should reject invalid URIs', () => {
      const invalidRoot: RootDefinition = {
        uri: 'invalid-uri',
        name: 'Invalid',
      };

      expect(() => provider.registerRoot(invalidRoot)).toThrow(InvalidParamsError);
    });

    it('should handle roots without names', async () => {
      const rootDef: RootDefinition = {
        uri: 'file:///tmp',
      };

      provider.registerRoot(rootDef);

      const roots = await provider.listRoots();
      expect(roots[0].uri).toBe('file:///tmp');
      expect(roots[0].name).toBeUndefined();
    });
  });

  describe('root management', () => {
    it('should check if roots exist', () => {
      const root: RootDefinition = {
        uri: 'file:///test',
        name: 'Test',
      };

      expect(provider.hasRoot('file:///test')).toBe(false);
      provider.registerRoot(root);
      expect(provider.hasRoot('file:///test')).toBe(true);
    });

    it('should unregister roots', async () => {
      const root: RootDefinition = {
        uri: 'file:///test',
        name: 'Test',
      };

      provider.registerRoot(root);
      expect(provider.hasRoot('file:///test')).toBe(true);

      provider.unregisterRoot('file:///test');
      expect(provider.hasRoot('file:///test')).toBe(false);

      const roots = await provider.listRoots();
      expect(roots).toHaveLength(0);
    });

    it('should clear all roots', async () => {
      const root1: RootDefinition = {
        uri: 'file:///test1',
        name: 'Test 1',
      };
      const root2: RootDefinition = {
        uri: 'file:///test2',
        name: 'Test 2',
      };

      provider.registerRoot(root1);
      provider.registerRoot(root2);

      let roots = await provider.listRoots();
      expect(roots).toHaveLength(2);

      provider.clear();

      roots = await provider.listRoots();
      expect(roots).toHaveLength(0);
    });
  });

  describe('static factory methods', () => {
    it('should create file roots', () => {
      const root = McpRootProvider.createFileRoot('/home/user/project', 'My Project', {
        recursive: true,
      });

      expect(root.uri).toBe('file:///home/user/project');
      expect(root.name).toBe('My Project');
      expect(root.metadata).toMatchObject({ recursive: true });
    });

    it('should create HTTP roots', () => {
      const root = McpRootProvider.createHttpRoot('https://api.example.com', 'API Root');

      expect(root.uri).toBe('https://api.example.com');
      expect(root.name).toBe('API Root');
    });

    it('should create HTTP roots with default names', () => {
      const root = McpRootProvider.createHttpRoot('https://api.example.com');

      expect(root.uri).toBe('https://api.example.com');
      expect(root.name).toBe('api.example.com');
    });

    it('should create memory roots', () => {
      const root = McpRootProvider.createMemoryRoot('cache', 'Memory Cache', {
        includeHidden: false,
      });

      expect(root.uri).toBe('memory://cache');
      expect(root.name).toBe('Memory Cache');
      expect(root.metadata).toMatchObject({ includeHidden: false });
    });
  });
});
